import { S3 } from "aws-sdk";

import { DefaultRouteCollection } from "@mcma/api";
import { DynamoDbTableProvider } from "@mcma/aws-dynamodb";

import { MediaAsset } from "@local/model";
import { signUrl } from "./utils";
import { getWorkerFunctionId, WorkerInvoker } from "@mcma/worker-invoker";

function signMediaAssetUrls(mediaAsset: MediaAsset, s3: S3) {
    if (mediaAsset.thumbnailUrl) {
        mediaAsset.thumbnailUrl = signUrl(mediaAsset.thumbnailUrl, s3);
    }
    if (mediaAsset.videoUrl) {
        mediaAsset.videoUrl = signUrl(mediaAsset.videoUrl, s3);
    }
}

export function buildAssetRoutes(dbTableProvider: DynamoDbTableProvider, workerInvoker: WorkerInvoker, s3: S3) {
    const routes = new DefaultRouteCollection(dbTableProvider, MediaAsset, "/assets");

    routes.remove("create");
    routes.remove("update");

    routes.get.onCompleted = async (requestContext, mediaAsset) => {
        signMediaAssetUrls(mediaAsset, s3);
    };
    routes.query.onCompleted = async (requestContext, queryResults) => {
        for (const mediaAsset of queryResults.results) {
            signMediaAssetUrls(mediaAsset, s3);
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

