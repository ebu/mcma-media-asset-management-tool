import { Context } from "aws-lambda";
import * as AWSXRay from "aws-xray-sdk-core";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { S3Client } from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import { default as axios } from "axios";

import { Job, McmaException, McmaTracker, NotificationEndpointProperties } from "@mcma/core";
import { AwsCloudWatchLoggerProvider, getLogGroupName } from "@mcma/aws-logger";
import { buildS3Url, S3Locator } from "@mcma/aws-s3";
import { AuthProvider, getResourceManagerConfig, ResourceManager } from "@mcma/client";
import { awsV4Auth } from "@mcma/aws-client";
import { getTableName } from "@mcma/data";
import { getPublicUrl } from "@mcma/api";

import { ImageEssence, ImageTechnicalMetadata, MediaAssetProperties } from "@local/model";
import { DataController } from "@local/data";

const { MEDIA_BUCKET } = process.env;

const dynamoDBClient = AWSXRay.captureAWSv3Client(new DynamoDBClient({}));
const s3Client = AWSXRay.captureAWSv3Client(new S3Client({}));

const loggerProvider = new AwsCloudWatchLoggerProvider("media-ingest-06-register-thumbnail", getLogGroupName());
const resourceManager = new ResourceManager(getResourceManagerConfig(), new AuthProvider().add(awsV4Auth()));
const dataController = new DataController(getTableName(), getPublicUrl(), true, dynamoDBClient);

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
        createThumbnailJobId: string
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

        logger.info("Retrieving thumbnail job results");
        let job = await resourceManager.get<Job>(event.data.createThumbnailJobId);
        logger.info(job);

        logger.info("Copying thumbnail file to final location");
        const outputFile = job.jobOutput.outputFile as S3Locator;

        const filename = outputFile.key.substring(outputFile.key.lastIndexOf("/") + 1);
        const extension = filename.substring(filename.lastIndexOf(".") + 1).toLowerCase();
        const objectKey = `${event.data.mediaAssetId.substring(getPublicUrl().length + 1)}/${filename}`;

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
                Key: objectKey,
                Body: response.data,
                ContentType: contentType,
            }
        });
        await upload.done();

        logger.info("Creating Image Essence");
        const imageTechnicalMetadata = new ImageTechnicalMetadata({
            width: 320,
            height: 180,
            codec: "JPEG",
            aspectRatio: "16/9",
        });

        const thumbnailUrl = await buildS3Url(MEDIA_BUCKET, objectKey, s3Client);

        const locators = [new S3Locator({ url: thumbnailUrl })];
        const tags: string[] = ["Thumbnail"];

        const imageEssence = await dataController.createMediaEssence(event.data.mediaAssetId, new ImageEssence({
            filename,
            extension,
            size,
            imageTechnicalMetadata,
            locators,
            tags,
        }));
        logger.info(imageEssence);

        const mutex = await dataController.createMutex({ name: event.data.mediaAssetId, holder: context.awsRequestId, logger });
        await mutex.lock();
        try {
            const mediaAsset = await dataController.get<MediaAssetProperties>(event.data.mediaAssetId);
            mediaAsset.thumbnailUrl = thumbnailUrl;
            await dataController.put(mediaAsset.id, mediaAsset);
        } finally {
            await mutex.unlock();
        }

    } catch (error) {
        logger.error("Failed to register thumbnail");
        logger.error(error);
        throw new McmaException("Failed to register thumbnail", error);
    } finally {
        logger.functionEnd(context.awsRequestId);
        await loggerProvider.flush();
    }
}
