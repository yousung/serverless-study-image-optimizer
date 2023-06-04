# 서버리스 이미지 최적화 (Serverless Image Optimizer)

## 목표
- 서버리스 이미지 최적화 만들기를 통하여서 aws serverless 아키텍쳐 이해
- serverless 프레임워크 이해
- typescript 로 작성하며, typescript 이해

## 이미지 최적화 아키텍쳐
1. 온디멘드 방식 -> 이미지 업로드 즉시 처리하여 s3 에 업로드
2. 이벤트 직접 호출 방식
3. 이벤트 구독 방식

## 필수 설치
- serverless framework
- aws cli

## option 설치
- direnv


### 환경설정
- aws cli 설치
```shell
# aws cli 설치
brew install awscli

# aws 인증 설정
aws configure

# AWS Key ID : [AWS Console IAM 에서 발급받은 Key ID] 
# AWS Secret Access Key : [AWS Console IAM 에서 발급받은 Secret Access Key]
# Default region name : [원하는 디폴트 리전, (한국 ap-northeast-2)]
# Default output format : [원하는 Response 포맷 (json)]
```

- serverless framework 설치
```shell
npm i serverless -g
```

- direnv가 설치되어 있는 경우에는 .envrc 에 작성
```dotenv
export BUCKET_NAME=[S3 버킷이름]
export ROOT_DOMAIN=[구매한 도메인 이름]
export SUB_DOMAIN=[1차 서브 도메인]
export INFRA_DOMAIN=[2차 도메인 사용시 환경구성 (예제에서는 production, qa, dev)]


export AWS_ACCESS_KEY_ID=[AWS access key]
export AWS_SECRET_ACCESS_KEY=[AWS secret key]
export AWS_DEFAULT_REGION=[region, 예제에서는 (ap-northeast-2)]
export ACM_CERTIFICATE_ARN=[미리 요청된 SSL의 ARN]
```

### 패키지
```shell
sls package
# serverless package
# npm run package
```

### 배포
```shell
sls deploy
# serverless deploy
# npm run deploy
```

### 제거
```shell
sls remove
# serverless remove
# npm run remove
```

### 설명
[이미지 최적화 블로그](https://lovizu.tistory.com/entry/%EC%84%9C%EB%B2%84%EB%A6%AC%EC%8A%A4-%EC%9D%B4%EB%AF%B8%EC%A7%80-%EC%B5%9C%EC%A0%81%ED%99%94-%EA%B3%B5%EB%B6%80)


### issue
#### sls remove 가 안될 때
- 사용한 s3 버킷이 비어있지 않으면, 명령어가 제대로 작동하지 않음, 비운 후에 다시 명령어 사용할 것
