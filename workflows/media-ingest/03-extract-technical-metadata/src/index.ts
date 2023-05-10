import { Context } from "aws-lambda";
import * as AWSXRay from "aws-xray-sdk-core";
import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { GetActivityTaskCommand, SFNClient } from "@aws-sdk/client-sfn";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import {
    AmeJob,
    JobParameterBag,
    JobProfile,
    McmaException,
    McmaTracker,
    NotificationEndpoint,
    NotificationEndpointProperties
} from "@mcma/core";
import { AwsCloudWatchLoggerProvider, getLogGroupName } from "@mcma/aws-logger";
import { S3Locator } from "@mcma/aws-s3";
import { AuthProvider, getResourceManagerConfig, ResourceManager } from "@mcma/client";
import { awsV4Auth } from "@mcma/aws-client";

const { ACTIVITY_ARN } = process.env;

const s3Client = AWSXRay.captureAWSv3Client(new S3Client({}));
const sfnClient = AWSXRay.captureAWSv3Client(new SFNClient({}));

const loggerProvider = new AwsCloudWatchLoggerProvider("media-ingest-03-extract-technical-metadata", getLogGroupName());
const resourceManager = new ResourceManager(getResourceManagerConfig(), new AuthProvider().add(awsV4Auth()));

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

        const data = await sfnClient.send(new GetActivityTaskCommand({ activityArn: ACTIVITY_ARN }));
        logger.info(data);

        const taskToken = data.taskToken;
        if (!taskToken) {
            throw new McmaException("Failed to obtain activity task");
        }

        // using input from activity task to ensure we don't have race conditions if two workflows execute simultaneously.
        event = JSON.parse(data.input);

        const notificationUrl = event.notificationEndpoint.httpEndpoint + "?taskToken=" + encodeURIComponent(taskToken);
        logger.info(`NotificationUrl: ${notificationUrl}`);

        const [jobProfile] = await resourceManager.query(JobProfile, { name: "ExtractTechnicalMetadata" });
        if (!jobProfile) {
            throw new McmaException("JobProfile 'ExtractTechnicalMetadata' not found.");
        }

        const inputFile = event.input.inputFile;

        const command = new GetObjectCommand({
            Bucket: inputFile.bucket,
            Key: inputFile.key,
        });
        inputFile.url = await getSignedUrl(s3Client, command, { expiresIn: 12 * 3600 });

        let job = new AmeJob({
            jobProfileId: jobProfile.id,
            jobInput: new JobParameterBag({
                inputFile
            }),
            notificationEndpoint: new NotificationEndpoint({
                httpEndpoint: notificationUrl
            }),
            tracker: event.tracker
        });

        logger.info("Creating job...");
        job = await resourceManager.create(job);

        logger.info(job);
    } catch (error) {
        logger.error("Failed to extract technical metadata");
        logger.error(error);
        throw new McmaException("Failed to extract technical metadata", error);
    } finally {
        logger.functionEnd(context.awsRequestId);
        await loggerProvider.flush();
    }
}
