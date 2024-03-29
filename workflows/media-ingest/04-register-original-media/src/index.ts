import { Context } from "aws-lambda";
import * as AWSXRay from "aws-xray-sdk-core";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { S3Client } from "@aws-sdk/client-s3";
import { default as axios } from "axios";
import * as moment from "moment";

import { Job, Logger, McmaException, McmaTracker, NotificationEndpointProperties } from "@mcma/core";
import { AwsCloudWatchLoggerProvider, getLogGroupName } from "@mcma/aws-logger";
import { buildS3Url, S3Locator } from "@mcma/aws-s3";
import { AuthProvider, getResourceManagerConfig, ResourceManager } from "@mcma/client";
import { awsV4Auth } from "@mcma/aws-client";
import { getTableName } from "@mcma/data";
import { getPublicUrl } from "@mcma/api";

import { AudioTechnicalMetadata, BitRateMode, MediaAssetProperties, VideoEssence, VideoScanType, VideoTechnicalMetadata } from "@local/model";
import { DataController, S3Utils } from "@local/data";

const { MEDIA_BUCKET } = process.env;

const dynamoDBClient = AWSXRay.captureAWSv3Client(new DynamoDBClient({}));
const s3Client = AWSXRay.captureAWSv3Client(new S3Client({}));

const loggerProvider = new AwsCloudWatchLoggerProvider("media-ingest-04-register-original-media", getLogGroupName());
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

        logger.info("Retrieving technical metadata job results");
        let job = await resourceManager.get<Job>(event.data.technicalMetadataJobId);
        logger.info(job);

        logger.info("Retrieving technical metadata");
        const outputFile = job.jobOutput.outputFile as S3Locator;
        const metadata = (await axios.get(outputFile.url)).data;
        logger.info(metadata);

        const filename = event.input.inputFile.key.substring(event.input.inputFile.key.lastIndexOf("/") + 1);
        const extension = filename.substring(filename.lastIndexOf(".") + 1).toLowerCase();

        logger.info("Copying media file to final location");
        const target = {
            bucket: MEDIA_BUCKET,
            key: `${event.data.mediaAssetId.substring(getPublicUrl().length + 1)}/${filename}`
        };
        await S3Utils.multipartCopy(event.input.inputFile, target, s3Client);

        const tags: string[] = ["Original"];

        const ebucoreVideoFormat = extractMetadata(metadata, "ebucore:videoFormat", logger);
        const ebucoreAudioFormat = extractMetadata(metadata, "ebucore:audioFormat", logger);
        const ebucoreDuration = extractMetadata(metadata, "ebucore:duration", logger);
        const ebucoreFileSize = extractMetadata(metadata, "ebucore:fileSize", logger);

        const durationStr = ebucoreDuration[0]?.["ebucore:normalPlayTime"]?.[0]?.["#value"];
        const duration = moment.duration(durationStr).asMilliseconds() / 1000;

        let size = Number.parseInt(ebucoreFileSize[0]?.["#value"]);
        if (Number.isNaN(size)) {
            size = undefined;
        }

        const videoUrl = await buildS3Url(target.bucket, target.key, s3Client);

        const locators = [new S3Locator({ url: videoUrl })];

        if (ebucoreVideoFormat) {
            const videoTechnicalMetadata = createVideoTechnicalMetadata(ebucoreVideoFormat);
            const audioTechnicalMetadata = ebucoreAudioFormat ? createAudioTechnicalMetadata(ebucoreAudioFormat) : undefined;

            const createWebVersion = extension !== "mp4" ||
                                     videoTechnicalMetadata.codec !== "AVC" ||
                                     videoTechnicalMetadata.height > 720 ||
                                     videoTechnicalMetadata.bitRate > 5500000; // 10% margin for desired bitrate of 5Mbit

            if (!createWebVersion) {
                tags.push("Web");
            }

            logger.info("Creating Video Essence");
            const videoEssence = await dataController.createMediaEssence(event.data.mediaAssetId, new VideoEssence({
                filename,
                extension,
                size,
                duration,
                videoTechnicalMetadata,
                audioTechnicalMetadata,
                locators,
                tags,
            }));

            logger.info(videoEssence);

            if (!createWebVersion) {
                const mutex = await dataController.createMutex({ name: event.data.mediaAssetId, holder: context.awsRequestId, logger });
                await mutex.lock();
                try {
                    const mediaAsset = await dataController.get<MediaAssetProperties>(event.data.mediaAssetId);
                    mediaAsset.videoUrl = videoUrl;
                    await dataController.put(mediaAsset.id, mediaAsset);
                } finally {
                    await mutex.unlock();
                }
            }

            return createWebVersion;
        } else {
            throw new McmaException("Not implemented");
        }
    } catch (error) {
        logger.error("Failed to register original media");
        logger.error(error);
        throw new McmaException("Failed to register original media", error);
    } finally {
        logger.functionEnd(context.awsRequestId);
        await loggerProvider.flush();
    }
}

function extractMetadata(metadata: any, component: string, logger: Logger): any[] {
    logger.debug(component);

    metadata = metadata["ebucore:ebuCoreMain"]["ebucore:coreMetadata"];

    logger.debug(metadata);
    const format = metadata.find((e: any) => e["ebucore:format"])?.["ebucore:format"];

    logger.debug(format);
    return format?.find((e: any) => e[component])?.[component];
}

function createVideoTechnicalMetadata(ebucoreVideoFormat: any): VideoTechnicalMetadata {
    const codec = ebucoreVideoFormat[0]?.["@videoFormatName"];

    let width = Number.parseInt(ebucoreVideoFormat[0]?.["ebucore:width"]?.[0]?.["#value"]);
    if (Number.isNaN(width)) {
        width = undefined;
    }

    let height = Number.parseInt(ebucoreVideoFormat[0]?.["ebucore:height"]?.[0]?.["#value"]);
    if (Number.isNaN(height)) {
        height = undefined;
    }

    const aspectRatioNumerator = Number.parseInt(ebucoreVideoFormat[0]?.["ebucore:aspectRatio"]?.[0]?.["ebucore:factorNumerator"]?.[0]?.["#value"]);
    const aspectRatioDenominator = Number.parseInt(ebucoreVideoFormat[0]?.["ebucore:aspectRatio"]?.[0]?.["ebucore:factorDenominator"]?.[0]?.["#value"]);
    const aspectRatio = !Number.isNaN(aspectRatioNumerator) && !Number.isNaN(aspectRatioDenominator) ? `${aspectRatioNumerator}/${aspectRatioDenominator}` : undefined;

    let frameRate = Number.parseFloat(ebucoreVideoFormat[0]?.["ebucore:frameRate"]?.[0]?.["#value"]);
    if (Number.isNaN(frameRate)) {
        frameRate = undefined;
    } else {
        const factorNumerator = Number.parseInt(ebucoreVideoFormat[0]?.["ebucore:frameRate"]?.[0]?.["@factorNumerator"]);
        const factorDenominator = Number.parseInt(ebucoreVideoFormat[0]?.["ebucore:frameRate"]?.[0]?.["@factorDenominator"]);
        if (!Number.isNaN(factorNumerator) && !Number.isNaN(factorDenominator)) {
            frameRate = (frameRate * factorNumerator / factorDenominator);
        }
    }

    let bitRate = Number.parseInt(ebucoreVideoFormat[0]?.["ebucore:bitRate"]?.[0]?.["#value"]);
    if (Number.isNaN(bitRate)) {
        bitRate = undefined;
    } else {
        bitRate = Math.ceil(bitRate / 1000);
    }

    let bitRateMode = BitRateMode.Unknown;
    const bitRateModeStr = ebucoreVideoFormat[0]?.["ebucore:bitRateMode"]?.[0]?.["#value"];
    if (bitRateModeStr) {
        switch (bitRateModeStr) {
            case "variable":
                bitRateMode = BitRateMode.VariableBitRate;
                break;
            case "constant":
                bitRateMode = BitRateMode.ConstantBitRate;
                break;
            default:
                throw new McmaException(`Unexpected video bitrate '${bitRateModeStr}'`);
        }
    }

    let scanType = VideoScanType.Unknown;
    const scanTypeStr = ebucoreVideoFormat[0]?.["ebucore:scanningFormat"]?.[0]?.["#value"];
    if (scanTypeStr) {
        switch (scanTypeStr) {
            case "progressive":
                scanType = VideoScanType.ProgressiveFrame;
                break;
            case "interlaced":
                const scanningOrder = ebucoreVideoFormat[0]?.["ebucore:scanningOrder"]?.[0]?.["#value"];
                if (scanningOrder !== "top") {
                    scanType = VideoScanType.InterlacedLowerFieldFirst
                } else {
                    scanType = VideoScanType.InterlacedUpperFieldFirst
                }
                break;
            default:
                throw new McmaException(`Unexpected video scan type '${scanTypeStr}'`);
        }
    }
    return new VideoTechnicalMetadata({
        codec,
        width,
        height,
        aspectRatio,
        frameRate,
        bitRate,
        bitRateMode,
        scanType,
    });
}

function createAudioTechnicalMetadata(ebucoreAudioFormat: any): AudioTechnicalMetadata {
    const codec = ebucoreAudioFormat[0]?.["@audioFormatName"];

    let channels = Number.parseInt(ebucoreAudioFormat[0]?.["ebucore:channels"]?.[0]?.["#value"]);
    if (Number.isNaN(channels)) {
        channels = undefined;
    }

    let samplingRate = Number.parseInt(ebucoreAudioFormat[0]?.["ebucore:samplingRate"]?.[0]?.["#value"]);
    if (Number.isNaN(samplingRate)) {
        samplingRate = undefined;
    }

    let bitRate = Number.parseInt(ebucoreAudioFormat[0]?.["ebucore:bitRate"]?.[0]?.["#value"]);
    if (Number.isNaN(bitRate)) {
        bitRate = undefined;
    } else {
        bitRate = Math.ceil(bitRate / 1000);
    }

    let bitRateMode = BitRateMode.Unknown;
    const bitRateModeStr = ebucoreAudioFormat[0]?.["ebucore:bitRateMode"]?.[0]?.["#value"];
    if (bitRateModeStr) {
        switch (bitRateModeStr) {
            case "variable":
                bitRateMode = BitRateMode.VariableBitRate;
                break;
            case "constant":
                bitRateMode = BitRateMode.ConstantBitRate;
                break;
            default:
                throw new McmaException(`Unexpected audio bitrate '${bitRateModeStr}'`);
        }
    }

    return new AudioTechnicalMetadata({
        codec,
        channels,
        samplingRate,
        bitRate,
        bitRateMode,
    });
}
