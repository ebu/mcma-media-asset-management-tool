import { Context } from "aws-lambda";
import * as AWSXRay from "aws-xray-sdk-core";
import { default as axios } from "axios";

import { Job, JobProperties, McmaException, McmaTracker, NotificationEndpointProperties } from "@mcma/core";
import { AwsCloudWatchLoggerProvider } from "@mcma/aws-logger";
import { buildS3Url, S3Locator } from "@mcma/aws-s3";
import { AuthProvider, getResourceManagerConfig, ResourceManager } from "@mcma/client";
import { awsV4Auth } from "@mcma/aws-client";

import { MediaAssetWorkflow, MediaEssence } from "@local/model";
import { DataController } from "@local/data";

const { MediaBucket, TableName, PublicUrl } = process.env;

const AWS = AWSXRay.captureAWS(require("aws-sdk"));
const s3 = new AWS.S3();

const loggerProvider = new AwsCloudWatchLoggerProvider("aws-celebrity-recognition-03-register-output", process.env.LogGroupName);
const resourceManager = new ResourceManager(getResourceManagerConfig(), new AuthProvider().add(awsV4Auth(AWS)));
const dataController = new DataController(TableName, PublicUrl, true, new AWS.DynamoDB());

type InputEvent = {
    input: {
        mediaWorkflowId?: string
        mediaAssetId?: string
        mediaAssetWorkflowId?: string
        inputFile?: S3Locator
    }
    data: {
        celebrityRecognitionJobId: string
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

        logger.info("Retrieving celebrity recognition job results");
        let job = (await resourceManager.get<Job>(event.data.celebrityRecognitionJobId)) as JobProperties;
        logger.info(job);

        logger.info("Copying celebrity recognition data file to final location");
        const outputFile = job.jobOutput.outputFile as S3Locator;

        let filename = outputFile.key.substring(outputFile.key.lastIndexOf("/") + 1);
        const extension = filename.substring(filename.lastIndexOf(".") + 1).toLowerCase();

        filename = filename.replace("." + extension, "-" + new Date().toISOString().substring(0, 19).replace(/[:-]/g, "").replace("T", "-") + "." + extension);
        const key = `${event.input.mediaAssetId.substring(PublicUrl.length + 1)}/${filename}`;

        const response = await axios.get(outputFile.url, { responseType: "stream" });
        logger.info(response.headers);
        let size = Number.parseInt(response.headers["content-length"]);
        if (Number.isNaN(size)) {
            size = undefined;
        }
        const contentType = response.headers["content-type"];

        const uploadParams: AWS.S3.Types.PutObjectRequest = {
            Bucket: MediaBucket,
            Key: key,
            Body: response.data,
            ContentType: contentType,
        };
        await s3.upload(uploadParams).promise();

        logger.info("Creating Media Essence");
        const thumbnailUrl = await buildS3Url(uploadParams.Bucket, uploadParams.Key, s3);

        const locators = [new S3Locator({ url: thumbnailUrl })];
        const tags: string[] = ["AwsCelebrityRecognition"];

        const essence = await dataController.createMediaEssence(event.input.mediaAssetId, new MediaEssence({
            filename,
            extension,
            size,
            locators,
            tags,
        }));
        logger.info(essence);

        const mediaAssetWorkflow = await dataController.get<MediaAssetWorkflow>(event.input.mediaAssetWorkflowId);
        mediaAssetWorkflow.data.mediaEssenceId = essence.id;
        await dataController.put(mediaAssetWorkflow.id, mediaAssetWorkflow);
    } catch (error) {
        logger.error("Failed to register output");
        logger.error(error);
        throw new McmaException("Failed to register output", error);
    } finally {
        logger.functionEnd(context.awsRequestId);
        await loggerProvider.flush();
    }
}