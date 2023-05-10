import { S3Client } from "@aws-sdk/client-s3";

import { DefaultRouteCollection } from "@mcma/api";
import { DynamoDbTableProvider } from "@mcma/aws-dynamodb";
import { getWorkerFunctionId, WorkerInvoker } from "@mcma/worker-invoker";

import { MediaAsset } from "@local/model";
import { signUrl } from "./utils";

async function signMediaAssetUrls(mediaAsset: MediaAsset, s3Client: S3Client) {
    if (mediaAsset.thumbnailUrl) {
        mediaAsset.thumbnailUrl = await signUrl(mediaAsset.thumbnailUrl, s3Client);
    }
    if (mediaAsset.videoUrl) {
        mediaAsset.videoUrl = await signUrl(mediaAsset.videoUrl, s3Client);
    }
}

export function buildAssetRoutes(dbTableProvider: DynamoDbTableProvider, workerInvoker: WorkerInvoker, s3Client: S3Client) {
    const routes = new DefaultRouteCollection(dbTableProvider, MediaAsset, "/assets");

    routes.remove("create");
    routes.remove("update");

    routes.get.onCompleted = async (requestContext, mediaAsset) => {
        await signMediaAssetUrls(mediaAsset, s3Client);
    };
    routes.query.onCompleted = async (requestContext, queryResults) => {
        for (const mediaAsset of queryResults.results) {
            await signMediaAssetUrls(mediaAsset, s3Client);
        }
    };

    routes.delete.onCompleted = async function(requestContext, resource) {
        await workerInvoker.invoke(
            getWorkerFunctionId(requestContext.configVariables),
            {
                operationName: "DeleteAsset",
                input: {
                    mediaAsset: resource
                },
            }
        );
    };

    return routes;
}

