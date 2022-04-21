import { DefaultRouteCollection } from "@mcma/api";
import { DynamoDbTableProvider } from "@mcma/aws-dynamodb";

import { MediaEssence } from "@local/model";
import { getTableName } from "@mcma/data";

import { parentResourceExists, signUrl } from "./utils";
import { S3 } from "aws-sdk";

function signMediaEssenceUrls(mediaEssence: MediaEssence, s3: S3) {
    if (mediaEssence.locators) {
        for (const locator of mediaEssence.locators) {
            if (locator["@type"] === "S3Locator") {
                locator.url = signUrl(locator.url, s3);
            }
        }
    }
}

export function buildAssetEssenceRoutes(dbTableProvider: DynamoDbTableProvider, s3: S3) {
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
        signMediaEssenceUrls(mediaEssence, s3);
    };
    routes.query.onCompleted = async (requestContext, queryResults) => {
        for (const mediaEssence of queryResults.results) {
            signMediaEssenceUrls(mediaEssence, s3);
        }
    };

    return routes;
}

