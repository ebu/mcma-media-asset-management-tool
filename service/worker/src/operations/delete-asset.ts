import { ProviderCollection, WorkerRequest } from "@mcma/worker";
import { DataController } from "@local/data";
import { MediaAsset, MediaAssetWorkflow, MediaEssence } from "@local/model";
import { WorkerContext } from "../index";
import { S3 } from "aws-sdk";
import { S3Locator } from "@mcma/aws-s3";
import { Logger } from "@mcma/core";

export async function deleteAsset(providers: ProviderCollection, workerRequest: WorkerRequest, context: WorkerContext) {
    const logger = workerRequest.logger;
    const dataController = context.dataController;
    const s3 = context.s3;

    const mediaAsset: MediaAsset = workerRequest.input.mediaAsset;

    await deleteEssences(mediaAsset, dataController, s3, logger);
    await deleteWorkflows(mediaAsset, dataController, logger);
}

async function deleteEssences(mediaAsset: MediaAsset, dataController: DataController, s3: S3, logger: Logger) {
    let pageStartToken: string = undefined;
    do {
        const response = await dataController.query<MediaEssence>(`${mediaAsset.id}/essences`, 1000, pageStartToken);
        pageStartToken = response.nextPageStartToken;

        for (const essence of response.results) {
            for (const locator of essence.locators) {
                if (locator["@type"] === "S3Locator") {
                    const s3Locator = locator as S3Locator;
                    logger.info(`Deleting S3 Object '${s3Locator.key}' in bucket '${s3Locator.bucket}'`);
                    try {
                        await s3.deleteObject({
                            Bucket: s3Locator.bucket,
                            Key: s3Locator.key,
                        }).promise();
                    } catch (error) {
                        logger.warn(error);
                    }
                }
            }
            logger.info(`Deleting Essence '${essence.id}'`);
            try {
                await dataController.delete(essence.id);
            } catch (error) {
                logger.warn(error);
            }
        }
    } while (pageStartToken);
}

async function deleteWorkflows(mediaAsset: MediaAsset, dataController: DataController, logger: Logger) {
    let pageStartToken: string = undefined;
    do {
        const response = await dataController.query<MediaAssetWorkflow>(`${mediaAsset.id}/workflows`, 1000, pageStartToken);
        pageStartToken = response.nextPageStartToken;

        for (const assetWorkflow of response.results) {
            logger.info(`Deleting Media Workflow '${assetWorkflow.mediaWorkflowId}'`);
            try {
                await dataController.delete(assetWorkflow.mediaWorkflowId);
            } catch (error) {
                logger.warn(error);
            }
            logger.info(`Deleting Media Asset Workflow '${assetWorkflow.id}'`);
            try {
                await dataController.delete(assetWorkflow.id);
            } catch (error) {
                logger.warn(error);
            }
        }
    } while (pageStartToken);
}
