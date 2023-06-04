import type { AWS } from "@serverless/typescript";
import resources from "./s3-cloudfront";

const config: AWS = {
    service: "photo-optimizer-api",
    frameworkVersion: "3",
    provider: {
        name: "aws",
        runtime: "nodejs14.x",
        region: "ap-northeast-2",
        environment: {
            BUCKET_NAME: process.env.BUCKET_NAME!,
            ROOT_DOMAIN: process.env.ROOT_DOMAIN!,
            SUB_DOMAIN: process.env.SUB_DOMAIN!,
            INFRA_DOMAIN: process.env.INFRA_DOMAIN!,
            DISTRIBUTION_ID: { Ref: "PhotoCdn" },
        },
        iam: {
            role: {
                statements: [
                    {
                        Action: ["s3:PutObject", "s3:GetObject", "s3:DeleteObject"],
                        Effect: "Allow",
                        Resource: `arn:aws:s3:::${process.env.BUCKET_NAME}/raw/*`,
                    },
                    {
                        Action: ["s3:PutObject", "s3:GetObject"],
                        Effect: "Allow",
                        Resource: `arn:aws:s3:::${process.env.BUCKET_NAME}/photo/*`,
                    },
                    {
                        Action: ["cloudfront:CreateInvalidation"],
                        Effect: "Allow",
                        Resource: "*",
                    },
                ],
            },
        },
    },
    custom: {
        scripts: {
            hooks: {
                "webpack:package:packageModules":
                    "cp jpegoptim.tar.gz .webpack/service",
            },
        },
    },
    functions: {
        optimizeAndUpload: {
            handler: "handler.optimizeAndUpload",
            timeout: 900,
            events: [
                {
                    s3: {
                        bucket: process.env.BUCKET_NAME!,
                        event: "s3:ObjectCreated:*",
                        rules: [{ prefix: 'raw/' }],
                        existing: true,
                    },
                },
            ],
        },
        getSignedURL: {
            handler: "handler.getSignedURL",
            events: [
                {
                    httpApi: {
                        path: "/get-signed-url",
                        method: "get",
                    },
                },
            ],
        }
    },
    plugins: ["serverless-plugin-scripts", "serverless-webpack"],
    resources,
};

export = config;