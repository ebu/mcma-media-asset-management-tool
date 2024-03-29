import { Context } from "aws-lambda";
import * as AWSXRay from "aws-xray-sdk-core";
import { DeleteObjectCommand, S3Client } from "@aws-sdk/client-s3";

import { McmaException, McmaTracker, NotificationEndpointProperties } from "@mcma/core";
import { AwsCloudWatchLoggerProvider, getLogGroupName } from "@mcma/aws-logger";
import { S3Locator } from "@mcma/aws-s3";

const loggerProvider = new AwsCloudWatchLoggerProvider("media-ingest-09-cleanup-temp-location", getLogGroupName());

const s3Client = AWSXRay.captureAWSv3Client(new S3Client({}));

type InputEvent = {
    input: {
        mediaWorkflowId: string
        title: string
        description: string
        inputFile: S3Locator
    }
    data: {
        mediaAssetId: string
        mediaAssetWorkflowId: string
        technicalMetadataJobId: string
        createWebVersion: boolean
    }
    tracker?: McmaTracker
    notificationEndpoint: NotificationEndpointProperties
}

export async function handler(event: InputEvent, context: Context) {
    const logger = loggerProvider.get(context.awsRequestId, event.tracker);
    try {
        logger.functionStart(context.awsRequestId);
        logger.debug(event);
        logger.debug(context);

        logger.info("Deleting media file from temp location");
        await s3Client.send(new DeleteObjectCommand({ Bucket: event.input.inputFile.bucket, Key: event.input.inputFile.key }));

    } catch (error) {
        logger.error("Failed to register web version");
        logger.error(error);
        throw new McmaException("Failed to register web version", error);
    } finally {
        logger.functionEnd(context.awsRequestId);
        await loggerProvider.flush();
    }
}
