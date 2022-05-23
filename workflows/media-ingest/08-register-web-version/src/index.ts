import { Context } from "aws-lambda";
import * as AWSXRay from "aws-xray-sdk-core";
import { default as axios } from "axios";

import { Job, JobProperties, McmaException, McmaTracker, NotificationEndpointProperties } from "@mcma/core";
import { AwsCloudWatchLoggerProvider } from "@mcma/aws-logger";
import { buildS3Url, S3Locator } from "@mcma/aws-s3";
import { AuthProvider, getResourceManagerConfig, ResourceManager } from "@mcma/client";
import { awsV4Auth } from "@mcma/aws-client";

const { MediaBucket, TableName, PublicUrl } = process.env;
import { VideoEssence, VideoTechnicalMetadata, AudioTechnicalMetadata, MediaAssetProperties, VideoScanType, MediaEssence } from "@local/model";
import { DataController } from "@local/data";

const AWS = AWSXRay.captureAWS(require("aws-sdk"));
const s3 = new AWS.S3();

const loggerProvider = new AwsCloudWatchLoggerProvider("media-ingest-08-register-web-version", process.env.LogGroupName);
const resourceManager = new ResourceManager(getResourceManagerConfig(), new AuthProvider().add(awsV4Auth(AWS)));
const dataController = new DataController(TableName, PublicUrl, true, new AWS.DynamoDB());

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
        transcodeJobId: string
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

        const essences = await dataController.query<MediaEssence>(`${event.data.mediaAssetId}/essences`);
        const originalEssence = essences.results.find(e => e.tags.includes("Original")) as VideoEssence;

        logger.info("Retrieving transcode job results");
        let job = (await resourceManager.get<Job>(event.data.transcodeJobId)) as JobProperties;
        logger.info(job);

        logger.info("Copying video file to final location");
        const outputFile = job.jobOutput.outputFile as S3Locator;

        const filename = outputFile.key.substring(outputFile.key.lastIndexOf("/") + 1);
        const extension = filename.substring(filename.lastIndexOf(".") + 1).toLowerCase();
        const thumbnailKey = `${event.data.mediaAssetId.substring(PublicUrl.length + 1)}/${filename}`;

        const response = await axios.get(outputFile.url, { responseType: "stream" });
        logger.info(response.headers);
        let size = Number.parseInt(response.headers["content-length"]);
        if (Number.isNaN(size)) {
            size = undefined;
        }
        const contentType = response.headers["content-type"];

        const uploadParams: AWS.S3.Types.PutObjectRequest = {
            Bucket: MediaBucket,
            Key: thumbnailKey,
            Body: response.data,
            ContentType: contentType,
        };
        await s3.upload(uploadParams).promise();

        logger.info("Creating Video Essence");
        const videoTechnicalMetadata = new VideoTechnicalMetadata({
            codec: "AVC",
            width: 1280,
            height: 720,
            frameRate: originalEssence.videoTechnicalMetadata.frameRate,
            aspectRatio: "16/9",
            bitRate: 5000,
        });

        const url = await buildS3Url(uploadParams.Bucket, uploadParams.Key, s3);

        const audioTechnicalMetadata = new AudioTechnicalMetadata({
            codec: "AAC",
            channels: originalEssence.audioTechnicalMetadata.channels,
            samplingRate: originalEssence.audioTechnicalMetadata.samplingRate,
            bitRate: 128,
        });

        const locators = [new S3Locator({ url: url })];
        const tags: string[] = ["Web"];

        const videoEssence = await dataController.createMediaEssence(event.data.mediaAssetId, new VideoEssence({
            duration: originalEssence.duration,
            filename,
            extension,
            size,
            videoTechnicalMetadata,
            audioTechnicalMetadata,
            locators,
            tags,
        }));
        logger.info(videoEssence);

        const mutex = await dataController.createMutex({ name: event.data.mediaAssetId, holder: context.awsRequestId, logger });
        await mutex.lock();
        try {
            const mediaAsset = await dataController.get<MediaAssetProperties>(event.data.mediaAssetId);
            mediaAsset.videoUrl = url;
            await dataController.put(mediaAsset.id, mediaAsset);
        } finally {
            await mutex.unlock();
        }

    } catch (error) {
        logger.error("Failed to register web version");
        logger.error(error);
        throw new McmaException("Failed to register web version", error);
    } finally {
        logger.functionEnd(context.awsRequestId);
        await loggerProvider.flush();
    }
}
