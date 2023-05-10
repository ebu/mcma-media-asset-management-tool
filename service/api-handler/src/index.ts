import { APIGatewayProxyEvent, Context } from "aws-lambda";
import * as AWSXRay from "aws-xray-sdk-core";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { LambdaClient } from "@aws-sdk/client-lambda";
import { S3Client } from "@aws-sdk/client-s3";

import { ApiGatewayApiController } from "@mcma/aws-api-gateway";
import { McmaApiRouteCollection } from "@mcma/api";
import { DynamoDbTableProvider } from "@mcma/aws-dynamodb";
import { buildAssetEssenceRoutes, buildAssetRoutes, buildAssetWorkflowRoutes, buildWorkflowRoutes } from "./routes";
import { ConsoleLoggerProvider } from "@mcma/core";
import { LambdaWorkerInvoker } from "@mcma/aws-lambda-worker-invoker";

import { getDynamoDbOptions } from "@local/data";

const dynamoDBClient = AWSXRay.captureAWSv3Client(new DynamoDBClient({}));
const lambdaClient = AWSXRay.captureAWSv3Client(new LambdaClient({}));
const s3Client = AWSXRay.captureAWSv3Client(new S3Client({}));

const loggerProvider = new ConsoleLoggerProvider("mam-service-api-handler");
const dbTableProvider = new DynamoDbTableProvider(getDynamoDbOptions(false), dynamoDBClient);
const workerInvoker = new LambdaWorkerInvoker(lambdaClient);

const routes = new McmaApiRouteCollection();
routes.addRoutes(buildAssetRoutes(dbTableProvider, workerInvoker, s3Client));
routes.addRoutes(buildAssetEssenceRoutes(dbTableProvider, s3Client));
routes.addRoutes(buildAssetWorkflowRoutes(dbTableProvider));
routes.addRoutes(buildWorkflowRoutes(dbTableProvider, workerInvoker));

const restController = new ApiGatewayApiController(routes, loggerProvider);

export async function handler(event: APIGatewayProxyEvent, context: Context) {
    console.log(JSON.stringify(event, null, 2));
    console.log(JSON.stringify(context, null, 2));

    const logger = loggerProvider.get(context.awsRequestId);
    try {
        logger.functionStart(context.awsRequestId);
        logger.debug(event);
        logger.debug(context);

        return await restController.handleRequest(event, context);
    } finally {
        logger.functionEnd(context.awsRequestId);
    }
}
