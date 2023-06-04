import * as AWS from "aws-sdk";
import * as fs from "fs";
import * as childProcess from "child_process";

import {APIGatewayProxyHandlerV2, S3Handler} from "aws-lambda";
import tar from "tar";
import path from "path";

const s3: AWS.S3 = new AWS.S3();
const cloudfront: AWS.CloudFront = new AWS.CloudFront();

export const optimizeAndUpload: S3Handler = async (event) => {
    // 여러 객체에 대한 이벤트를 한 번에 처리할 수 있으므로 jpegoptim 준비는 한 번만 한다.
    await unpackJpegoptim();

    const resultKeys: string[] = [];

    // S3 객체 생성 이벤트로부터 받은 모든 키에 대해 최적화를 처리한다.
    for (const record of event.Records) {
        // 이벤트가 발생한 key는 "getSignedURL"에서 지정한 "Key" 값으로
        // Bucket에 업로드된 객체의 키다. "raw/photoKey.jpg" 형태이다.
        const rawKey: string = record.s3.object.key;
        const resultKey: string = await downloadAndOptimizeAndUpload(rawKey);

        // 최적화된 사진의 객체 키를 모아서 한 번에 CloudFront 캐시를 제거한다.
        resultKeys.push(resultKey);
    }

    // 사용자는 CDN URL을 "getSignedURL" 함수 호출 시 받으므로 이미 해당 URL에
    // 접근하여 404를 캐시했을 수 있다. 이를 제거하여 최적화된 사진 결과물을 받을 수 있도록 한다.
    await cloudfront
        .createInvalidation({
            DistributionId: process.env.DISTRIBUTION_ID!,
            InvalidationBatch: {
                Paths: {
                    Items: resultKeys.map((resultKey) => `/${resultKey}`),
                    Quantity: resultKeys.length,
                },
                // 중복 실행 방지를 위한 값이지만 현 시점에서는 의미가 없으므로 NOW를 넣는다.
                CallerReference: Date.now().toString(),
            },
        })
        .promise();
};

async function s3Exists(bucketName: string, key: string): Promise<boolean> {
    try {
        // headObject로 객체의 메타데이터를 조회하여 객체의 존재 여부를 판단한다.
        await new AWS.S3().headObject({ Bucket: bucketName, Key: key }).promise();
        return true;
    } catch (error: any) {
        // s3:ListObject 권한을 부여하지 않기 때문에 NotFound 대신
        // Forbidden으로 부재 여부를 판단해야 한다.
        if (error.code === "Forbidden") {
            return false;
        }
        throw error;
    }
}

const jpegoptimPath: string = "/tmp/bin/jpegoptim";
const jpegoptimPackFile: string = "jpegoptim.tar.gz";

async function unpackJpegoptim(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
        // Lambda 인스턴스가 재사용되어 이미 jpegoptim이 준비된 경우
        // 그 실행 파일을 다시 사용한다.
        if (fs.existsSync(jpegoptimPath)) {
            return resolve();
        }
        // 만약 Lambda 인스턴스가 처음 사용되는 경우라 jpegoptim이 없다면
        // 지금 압축을 풀어 해당 실행 파일을 준비하도록 한다.
        fs.createReadStream(jpegoptimPackFile)
            .pipe(
                tar.x({ strip: 1, C: "/tmp" }).on("error", reject).on("close", resolve)
            )
            .on("error", reject);
    });
}

export const getSignedURL: APIGatewayProxyHandlerV2<unknown> = async () => {
    const photoKey:string = `${new Date().getTime()}${Math.random()}`;
    const uploadURL: string = await s3.getSignedUrlPromise("putObject", {
        Bucket: process.env.BUCKET_NAME!,
        Key: `raw/${photoKey}.jpg`,
        Expires: 5 * 60
    })

    const cdnURL: string = `https://${process.env.SUB_DOMAIN}.${process.env.INFRA_DOMAIN}.${process.env.ROOT_DOMAIN}/photo/${photoKey}.jpg`;

    return {
        cdnURL,
        uploadURL
    };
}

async function downloadAndOptimizeAndUpload(rawKey: string): Promise<string> {
    // "raw/photoKey.jpg"에서 "photoKey.jpg"를 가져온다.
    const photoKeyWithJpg = path.basename(rawKey);
    const filePath = `/tmp/${photoKeyWithJpg}`;

    // 업로드된 원본 사진을 임시 파일로 다운로드한다.
    await downloadBucketObject(process.env.BUCKET_NAME!, rawKey, filePath);

    // 결과를 담는 resultKey는 "photo/" 접두사를 가진다.
    const resultKey: string = `photo/${photoKeyWithJpg}`;
    try {
        // jpegoptim를 실행하여 최적화를 수행한다.
        childProcess.execSync(`${jpegoptimPath} -o -s -m80 ${filePath}`);

        // 최적화가 완료된 파일을 S3 Bucket에 업로드한다.
        await s3
            .upload({
                Bucket: process.env.BUCKET_NAME!,
                Key: resultKey,
                Body: fs.createReadStream(filePath),
                ContentType: "image/jpeg",
            })
            .promise();
        return resultKey;
    } finally {
        // 작업 임시 파일을 삭제하여 Lambda 인스턴스 재사용 시에 /tmp의 용량 부족이
        // 발생하지 않도록 한다.
        fs.unlinkSync(filePath);

        // 원본 사진 파일을 삭제하여 불필요한 S3 Bucket 용량 점유를 막는다.
        await s3
            .deleteObject({ Bucket: process.env.BUCKET_NAME!, Key: rawKey })
            .promise();
    }
}

async function downloadBucketObject(
    bucketName: string,
    key: string,
    localPath: string
): Promise<void> {
    return new Promise<void>((resolve, reject) =>
        s3
            .getObject({ Bucket: bucketName, Key: key })
            .createReadStream()
            .on("error", reject)
            .pipe(
                fs.createWriteStream(localPath).on("error", reject).on("close", resolve)
            )
    );
}
