import { Context } from "aws-lambda";
import * as AWSXRay from "aws-xray-sdk-core";

import { AuthProvider, ResourceManagerProvider } from "@mcma/client";
import { ProviderCollection, Worker, WorkerRequest, WorkerRequestProperties } from "@mcma/worker";
import { DynamoDbTableProvider } from "@mcma/aws-dynamodb";
import { AwsCloudWatchLoggerProvider } from "@mcma/aws-logger";
import { awsV4Auth } from "@mcma/aws-client";

import { DataController } from "@local/data";

import { deleteAsset, processNotification, startWorkflow } from "./operations";
import { S3 } from "aws-sdk";

const { LogGroupName, PublicUrl, TableName } = process.env;

const AWS = AWSXRay.captureAWS(require("aws-sdk"));

const authProvider = new AuthProvider().add(awsV4Auth(AWS));
const dbTableProvider = new DynamoDbTableProvider();
const loggerProvider = new AwsCloudWatchLoggerProvider("mam-service-worker", LogGroupName);
const resourceManagerProvider = new ResourceManagerProvider(authProvider);

const dataController = new DataController(TableName, PublicUrl, false, new AWS.DynamoDB());

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
            s3: new AWS.S3(),
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
    s3: S3,
}
