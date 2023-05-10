import { DefaultRouteCollection } from "@mcma/api";
import { DynamoDbTableProvider } from "@mcma/aws-dynamodb";

import { MediaEssence } from "@local/model";
import { getTableName } from "@mcma/data";

import { parentResourceExists, signUrl } from "./utils";
import { S3Client } from "@aws-sdk/client-s3";

async function signMediaEssenceUrls(mediaEssence: MediaEssence, s3Client: S3Client) {
    if (mediaEssence.locators) {
        for (const locator of mediaEssence.locators) {
            if (locator["@type"] === "S3Locator") {
                locator.url = await signUrl(locator.url, s3Client);
            }
        }
    }
}

export function buildAssetEssenceRoutes(dbTableProvider: DynamoDbTableProvider, s3Client: S3Client) {
    const routes = new DefaultRouteCollection(dbTableProvider, MediaEssence, "/assets/{assetId}/essences");

    routes.query.onStarted = async requestContext => {
        let table = await dbTableProvider.get(getTableName(requestContext.configVariables));
        if (!await parentResourceExists(requestContext.request.path, table)) {
            requestContext.setResponseResourceNotFound();
            return false;
        }

        return true;
    };

    routes.remove("create");
    routes.remove("update");

    routes.get.onCompleted = async (requestContext, mediaEssence) => {
        await signMediaEssenceUrls(mediaEssence, s3Client);
    };
    routes.query.onCompleted = async (requestContext, queryResults) => {
        for (const mediaEssence of queryResults.results) {
            await signMediaEssenceUrls(mediaEssence, s3Client);
        }
    };

    return routes;
}

