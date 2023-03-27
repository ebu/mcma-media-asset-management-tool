import { Context } from "aws-lambda";
import * as AWSXRay from "aws-xray-sdk-core";
import { default as axios } from "axios";

import { Job, McmaException, McmaTracker, NotificationEndpointProperties } from "@mcma/core";
import { AwsCloudWatchLoggerProvider, getLogGroupName } from "@mcma/aws-logger";
import { buildS3Url, S3Locator } from "@mcma/aws-s3";
import { AuthProvider, getResourceManagerConfig, ResourceManager } from "@mcma/client";
import { awsV4Auth } from "@mcma/aws-client";

import { AudioEssence, AudioTechnicalMetadata, BitRateMode, MediaAssetWorkflow, MediaEssence, VideoEssence } from "@local/model";
import { DataController } from "@local/data";
import { getTableName } from "@mcma/data";
import { getPublicUrl } from "@mcma/api";

const { MEDIA_BUCKET } = process.env;

const AWS = AWSXRay.captureAWS(require("aws-sdk"));
const s3 = new AWS.S3();

const loggerProvider = new AwsCloudWatchLoggerProvider("azure-transcription-04-register-output", getLogGroupName());
const resourceManager = new ResourceManager(getResourceManagerConfig(), new AuthProvider().add(awsV4Auth(AWS)));
const dataController = new DataController(getTableName(), getPublicUrl(), true, new AWS.DynamoDB());

type InputEvent = {
    input: {
        mediaWorkflowId?: string
        mediaAssetId?: string
        mediaAssetWorkflowId?: string
        inputFile?: S3Locator
    }
    data: {
        doExtractAudio: boolean
        transformJobId?: string
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

        const outputFiles: S3Locator[] = [];

        if (event.data.transformJobId) {
            logger.info("Retrieving Transform job results");
            const job = await resourceManager.get<Job>(event.data.transformJobId);
            logger.info(job);

            logger.info("Copying Transform output file to final location");
            outputFiles.push(job.jobOutput.outputFile as S3Locator);
        }

        if (event.data.aiJobId) {
            logger.info("Retrieving AI job results");
            let job = await resourceManager.get<Job>(event.data.aiJobId);
            logger.info(job);

            logger.info("Copying AI data file(s) to final location");
            outputFiles.push(...(job.jobOutput.outputFiles as S3Locator[]));
        }

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

            const uploadParams: AWS.S3.Types.PutObjectRequest = {
                Bucket: MEDIA_BUCKET,
                Key: key,
                Body: response.data,
                ContentType: contentType,
            };
            await s3.upload(uploadParams).promise();

            logger.info("Creating Media Essence");
            const url = await buildS3Url(uploadParams.Bucket, uploadParams.Key, s3);

            const locators = [new S3Locator({ url: url })];
            const tags: string[] = ["AzureTranscription"];

            let essence;
            if (extension === "wav") {
                const essences = await dataController.query<MediaEssence>(`${event.input.mediaAssetId}/essences`);
                const originalEssence = essences.results.find(e => e.tags.includes("Original")) as VideoEssence;

                essence = await dataController.createMediaEssence(event.input.mediaAssetId, new AudioEssence({
                    filename,
                    extension,
                    size,
                    locators,
                    tags,
                    duration: originalEssence.duration,
                    audioTechnicalMetadata: new AudioTechnicalMetadata({
                        codec: "PCM Little Endian",
                        bitRateMode: BitRateMode.ConstantBitRate,
                        channels: originalEssence.audioTechnicalMetadata.channels,
                        samplingRate: originalEssence.audioTechnicalMetadata.samplingRate,
                        sampleSize: 16,
                    })
                }))
            } else {
                essence = await dataController.createMediaEssence(event.input.mediaAssetId, new MediaEssence({
                    filename,
                    extension,
                    size,
                    locators,
                    tags,
                }));
            }
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
