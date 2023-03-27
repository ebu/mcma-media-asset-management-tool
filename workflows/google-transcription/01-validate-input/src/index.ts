import { Context } from "aws-lambda";
import * as AWSXRay from "aws-xray-sdk-core";

import { McmaException, McmaTracker, NotificationEndpointProperties } from "@mcma/core";
import { AwsCloudWatchLoggerProvider, getLogGroupName } from "@mcma/aws-logger";
import { S3Locator } from "@mcma/aws-s3";

const AWS = AWSXRay.captureAWS(require("aws-sdk"));

const loggerProvider = new AwsCloudWatchLoggerProvider("google-transcription-01-validate-input", getLogGroupName());

const s3 = new AWS.S3();

type InputEvent = {
    input?: {
        mediaWorkflowId?: string
        mediaAssetId?: string
        mediaAssetWorkflowId?: string
        inputFile?: S3Locator
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

        // check the input and return mediaFileLocator which service as input for the AI workflows
        if (!event?.input) {
            throw new McmaException("Missing workflow input");
        }
        if (!event.input.mediaWorkflowId) {
            throw new McmaException("Missing 'mediaWorkflowId' parameter in workflow input");
        }
        if (!event.input.mediaAssetId) {
            throw new McmaException("Missing 'mediaAssetId' parameter in workflow input");
        }
        if (!event.input.mediaAssetWorkflowId) {
            throw new McmaException("Missing 'mediaAssetWorkflowId' parameter in workflow input");
        }
        if (!event.input.inputFile) {
            throw new McmaException("Missing inputFile parameter in workflow input");
        }

        const { inputFile } = event.input;

        try {
            const result = await s3.headObject({
                Bucket: inputFile.bucket,
                Key: inputFile.key,
            }).promise();

            logger.info(result);
        } catch (error) {
            throw new McmaException("Input file is not retrievable due to error: " + error.message);
        }

        return !inputFile.key.endsWith(".flac");
    } catch (error) {
        logger.error("Failed to validate workflow input");
        logger.error(error);
        throw new McmaException("Failed to validate workflow input", error);
    } finally {
        logger.functionEnd(context.awsRequestId);
        await loggerProvider.flush();
    }
}
