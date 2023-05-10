import { Context } from "aws-lambda";
import * as AWSXRay from "aws-xray-sdk-core";
import { default as axios } from "axios";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { S3Client } from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";

import { Job, McmaException, McmaTracker, NotificationEndpointProperties } from "@mcma/core";
import { AwsCloudWatchLoggerProvider, getLogGroupName } from "@mcma/aws-logger";
import { buildS3Url, S3Locator } from "@mcma/aws-s3";
import { AuthProvider, getResourceManagerConfig, ResourceManager } from "@mcma/client";
import { awsV4Auth } from "@mcma/aws-client";
import { getTableName } from "@mcma/data";
import { getPublicUrl } from "@mcma/api";

import { MediaAssetWorkflow, MediaEssence } from "@local/model";
import { DataController } from "@local/data";

const { MEDIA_BUCKET } = process.env;

const dynamoDBClient = AWSXRay.captureAWSv3Client(new DynamoDBClient({}));
const s3Client = AWSXRay.captureAWSv3Client(new S3Client({}));

const loggerProvider = new AwsCloudWatchLoggerProvider("aws-celebrity-recognition-03-register-output", getLogGroupName());
const resourceManager = new ResourceManager(getResourceManagerConfig(), new AuthProvider().add(awsV4Auth()));
const dataController = new DataController(getTableName(), getPublicUrl(), true, dynamoDBClient);

type InputEvent = {
    input: {
        mediaWorkflowId?: string
        mediaAssetId?: string
        mediaAssetWorkflowId?: string
        inputFile?: S3Locator
    }
    data: {
        aiJobId: string
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
        let job = await resourceManager.get<Job>(event.data.aiJobId);
        logger.info(job);

        logger.info("Copying celebrity recognition data file to final location");
        const outputFiles = job.jobOutput.outputFiles as S3Locator[];

        const timestamp = new Date().toISOString().substring(0, 19).replace(/[:-]/g, "").replace("T", "-");
        const essenceIds: string[] = [];

        logger.info(outputFiles);
        for (const outputFile of outputFiles) {
            logger.info(outputFile);
            let filename = outputFile.key.substring(outputFile.key.lastIndexOf("/") + 1);
            const extension = filename.substring(filename.lastIndexOf(".") + 1).toLowerCase();

            filename = filename.replace("." + extension, "-" + timestamp + "." + extension);
            const key = `${event.input.mediaAssetId.substring(getPublicUrl().length + 1)}/${filename}`;

            const response = await axios.get(outputFile.url, { responseType: "stream" });
            logger.info(response.headers);
            let size = Number.parseInt(response.headers["content-length"]);
            if (Number.isNaN(size)) {
                size = undefined;
            }
            const contentType = response.headers["content-type"];

            const upload = new Upload({
                client: s3Client,
                params: {
                    Bucket: MEDIA_BUCKET,
                    Key: key,
                    Body: response.data,
                    ContentType: contentType,
                }
            });
            await upload.done();

            logger.info("Creating Media Essence");
            const url = await buildS3Url(MEDIA_BUCKET, key, s3Client);

            const locators = [new S3Locator({ url: url })];
            const tags: string[] = ["AwsCelebrityRecognition"];

            const essence = await dataController.createMediaEssence(event.input.mediaAssetId, new MediaEssence({
                filename,
                extension,
                size,
                locators,
                tags,
            }));
            logger.info(essence);

            essenceIds.push(essence.id);
        }

        const mediaAssetWorkflow = await dataController.get<MediaAssetWorkflow>(event.input.mediaAssetWorkflowId);
        mediaAssetWorkflow.data.mediaEssenceIds = essenceIds;
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
