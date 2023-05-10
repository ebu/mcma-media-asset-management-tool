import { Context } from "aws-lambda";
import * as AWSXRay from "aws-xray-sdk-core";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { S3Client } from "@aws-sdk/client-s3";

import { AuthProvider, ResourceManagerProvider } from "@mcma/client";
import { ProviderCollection, Worker, WorkerRequest, WorkerRequestProperties } from "@mcma/worker";
import { DynamoDbTableProvider } from "@mcma/aws-dynamodb";
import { AwsCloudWatchLoggerProvider, getLogGroupName } from "@mcma/aws-logger";
import { awsV4Auth } from "@mcma/aws-client";
import { getTableName } from "@mcma/data";
import { getPublicUrl } from "@mcma/api";

import { DataController } from "@local/data";

import { deleteAsset, processNotification, startWorkflow } from "./operations";

const dynamoDBClient = AWSXRay.captureAWSv3Client(new DynamoDBClient({}));
const s3Client = AWSXRay.captureAWSv3Client(new S3Client({}));

const authProvider = new AuthProvider().add(awsV4Auth());
const dbTableProvider = new DynamoDbTableProvider();
const loggerProvider = new AwsCloudWatchLoggerProvider("mam-service-worker", getLogGroupName());
const resourceManagerProvider = new ResourceManagerProvider(authProvider);

const dataController = new DataController(getTableName(), getPublicUrl(), false, dynamoDBClient);

const providerCollection = new ProviderCollection({
    authProvider,
    dbTableProvider,
    loggerProvider,
    resourceManagerProvider
});

const worker =
    new Worker(providerCollection)
        .addOperation("DeleteAsset", deleteAsset)
        .addOperation("ProcessNotification", processNotification)
        .addOperation("StartWorkflow", startWorkflow);

export async function handler(event: WorkerRequestProperties, context: Context) {
    const logger = loggerProvider.get(context.awsRequestId, event.tracker);

    try {
        logger.functionStart(context.awsRequestId);
        logger.debug(event);
        logger.debug(context);

        await worker.doWork(new WorkerRequest(event, logger), {
            awsRequestId: context.awsRequestId,
            dataController,
            s3Client,
        });
    } catch (error) {
        logger.error("Error occurred when handling operation '" + event.operationName + "'");
        logger.error(error);
    } finally {
        logger.functionEnd(context.awsRequestId);
        await loggerProvider.flush();
    }
}

export interface WorkerContext {
    awsRequestId: string,
    dataController: DataController,
    s3: S3Client,
}
