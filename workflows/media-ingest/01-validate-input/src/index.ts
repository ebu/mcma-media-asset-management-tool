import { Context } from "aws-lambda";
import * as AWSXRay from "aws-xray-sdk-core";
import { HeadObjectCommand, S3Client } from "@aws-sdk/client-s3";

import { McmaException, McmaTracker, NotificationEndpointProperties } from "@mcma/core";
import { AwsCloudWatchLoggerProvider, getLogGroupName } from "@mcma/aws-logger";
import { S3Locator } from "@mcma/aws-s3";

const s3Client = AWSXRay.captureAWSv3Client(new S3Client({}));

const loggerProvider = new AwsCloudWatchLoggerProvider("media-ingest-01-validate-input", getLogGroupName());

type InputEvent = {
    input?: {
        mediaWorkflowId?: string
        title?: string
        description?: string
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
        if (!event.input.title) {
            throw new McmaException("Missing 'title' parameter in workflow input");
        }
        if (typeof event.input.description !== "string") {
            throw new McmaException("Missing 'description' parameter in workflow input");
        }
        if (!event.input.inputFile) {
            throw new McmaException("Missing inputFile parameter in workflow input");
        }

        const { inputFile } = event.input;

        try {
            const result = await s3Client.send(new HeadObjectCommand({
                Bucket: inputFile.bucket,
                Key: inputFile.key,
            }));

            logger.info(result);
        } catch (error) {
            throw new McmaException("Input file is not retrievable due to error: " + error.message);
        }
    } catch (error) {
        logger.error("Failed to validate workflow input");
        logger.error(error);
        throw new McmaException("Failed to validate workflow input", error);
    } finally {
        logger.functionEnd(context.awsRequestId);
        await loggerProvider.flush();
    }
}
