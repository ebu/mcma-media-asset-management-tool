import { Context } from "aws-lambda";
import * as AWSXRay from "aws-xray-sdk-core";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";

import { McmaException, McmaTracker, NotificationEndpointProperties } from "@mcma/core";
import { AwsCloudWatchLoggerProvider, getLogGroupName } from "@mcma/aws-logger";
import { S3Locator } from "@mcma/aws-s3";
import { getTableName } from "@mcma/data";
import { getPublicUrl } from "@mcma/api";

import { MediaAsset, MediaAssetWorkflow, MediaWorkflowProperties } from "@local/model";
import { DataController } from "@local/data";

const dynamoDBClient = AWSXRay.captureAWSv3Client(new DynamoDBClient({}));

const loggerProvider = new AwsCloudWatchLoggerProvider("media-ingest-02-create-media-asset", getLogGroupName());
const dataController = new DataController(getTableName(), getPublicUrl(), true, dynamoDBClient);

type InputEvent = {
    input: {
        mediaWorkflowId: string
        title: string
        description: string
        inputFile: S3Locator
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

        const mediaAsset = await dataController.createMediaAsset(new MediaAsset({
            title: event.input.title,
            description: event.input.description
        }));

        const mutex = await dataController.createMutex({ name: event.input.mediaWorkflowId, holder: context.awsRequestId, logger });
        await mutex.lock();
        try {
            const mediaWorkflow = await dataController.get<MediaWorkflowProperties>(event.input.mediaWorkflowId);

            const mediaAssetWorkflow = await dataController.createMediaAssetWorkflow(mediaAsset.id, new MediaAssetWorkflow({
                mediaWorkflowId: mediaWorkflow.id,
                mediaWorkflowType: mediaWorkflow.type,
            }));

            mediaWorkflow.mediaAssetId = mediaAsset.id;
            mediaWorkflow.mediaAssetWorkflowId = mediaAssetWorkflow.id;

            await dataController.put(mediaWorkflow.id, mediaWorkflow);

            return {
                mediaAssetId: mediaAsset.id,
                mediaAssetWorkflowId: mediaAssetWorkflow.id,
            };
        } finally {
            await mutex.unlock();
        }
    } catch (error) {
        logger.error("Failed to create media asset");
        logger.error(error);
        throw new McmaException("Failed to create media asset", error);
    } finally {
        logger.functionEnd(context.awsRequestId);
        await loggerProvider.flush();
    }
}
