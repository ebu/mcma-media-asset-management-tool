import {
    APIGatewayEventDefaultAuthorizerContext,
    APIGatewayEventRequestContextWithAuthorizer,
    Context,
    DynamoDBStreamEvent
} from "aws-lambda";
import * as AWSXRay from "aws-xray-sdk-core";
import { ApiGatewayManagementApiClient, GoneException, PostToConnectionCommand } from "@aws-sdk/client-apigatewaymanagementapi";
import { CloudWatchLogsClient } from "@aws-sdk/client-cloudwatch-logs";
import { DynamoDBClient, AttributeValue } from "@aws-sdk/client-dynamodb";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { unmarshall } from "@aws-sdk/util-dynamodb";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import { AwsCloudWatchLoggerProvider, getLogGroupName } from "@mcma/aws-logger";
import { DynamoDbTableProvider } from "@mcma/aws-dynamodb";
import { getTableName, Query } from "@mcma/data";
import { McmaResource } from "@mcma/core";
import { S3Locator } from "@mcma/aws-s3";
import { MediaAsset } from "@local/model";

const cloudWatchLogsClient = AWSXRay.captureAWSv3Client(new CloudWatchLogsClient({}));
const dynamoDBClient = AWSXRay.captureAWSv3Client(new DynamoDBClient({}));
const s3Client = AWSXRay.captureAWSv3Client(new S3Client({}));

const loggerProvider = new AwsCloudWatchLoggerProvider("mam-service-db-trigger", getLogGroupName(), cloudWatchLogsClient);
const dbTableProvider = new DynamoDbTableProvider({}, dynamoDBClient);


export async function handler(event: DynamoDBStreamEvent, context: Context) {
    console.log(JSON.stringify(event, null, 2));
    console.log(JSON.stringify(context, null, 2));

    const logger = loggerProvider.get(context.awsRequestId);
    try {
        logger.functionStart(context.awsRequestId);
        logger.debug(event);
        logger.debug(context);

        const messages: any = [];

        for (const record of event.Records) {
            if (record.dynamodb?.Keys?.resource_pkey?.S === "/connections" ||
                record.dynamodb?.Keys?.resource_pkey?.S === "Mutex") {
                continue;
            }

            const newResource = record.dynamodb.NewImage ? unmarshall(record.dynamodb.NewImage as Record<string, AttributeValue>).resource as McmaResource : null;
            const oldResource = record.dynamodb.OldImage ? unmarshall(record.dynamodb.OldImage as Record<string, AttributeValue>).resource as McmaResource : null;

            let operation: string;
            switch (record.eventName) {
                case "INSERT":
                    operation = "Insert";
                    logger.info(newResource);
                    break;
                case "MODIFY":
                    operation = "Update";
                    logger.info(newResource);
                    break;
                case "REMOVE":
                    operation = "Delete";
                    break;
                default:
                    operation = record.eventName;
                    break;
            }

            const resource = newResource ?? oldResource;

            if (resource) {
                if (resource["@type"] === "MediaAsset") {
                    await signMediaAssetUrls(resource as MediaAsset);
                }

                messages.push({
                    operation,
                    resource
                });
            }
        }

        logger.info(`Detected ${messages.length} message(s) for sending to websocket clients`);

        if (messages.length > 0) {
            const table = await dbTableProvider.get(getTableName());

            const connections = [];

            const queryParams: Query<APIGatewayEventRequestContextWithAuthorizer<APIGatewayEventDefaultAuthorizerContext>> = {
                path: "/connections",
                pageStartToken: undefined,
            };

            do {
                const queryResults = await table.query(queryParams);
                connections.push(...queryResults.results);
                queryParams.pageStartToken = queryResults.nextPageStartToken;
            } while (queryParams.pageStartToken);

            logger.info(connections);

            logger.info(`Found ${connections.length} open websocket connection(s)`);
            if (connections.length > 0) {
                const postCalls = connections.map(async (connection) => {
                    const managementApiClient = AWSXRay.captureAWSv3Client(new ApiGatewayManagementApiClient({
                        endpoint: `https://${connection.domainName}/${connection.stage}`
                    }));

                    try {
                        for (const message of messages) {
                            await managementApiClient.send(new PostToConnectionCommand({
                                ConnectionId: connection.connectionId,
                                Data: new TextEncoder().encode(JSON.stringify(message)),
                            }));
                        }
                    } catch (e) {
                        logger.error(e);
                        if (e instanceof GoneException) {
                            logger.info("Removing stale connection " + connection.connectionId);
                            await table.delete("/connections/" + connection.connectionId);
                        } else {
                            throw e;
                        }
                    }
                });

                await Promise.all(postCalls);
            }
        }
    } catch (error) {
        logger.error(error);
        throw error;
    } finally {
        logger.functionEnd(context.awsRequestId);

        console.log("LoggerProvider.flush - START - " + new Date().toISOString());
        const t1 = Date.now();
        await loggerProvider.flush(Date.now() + context.getRemainingTimeInMillis() - 5000);
        const t2 = Date.now();
        console.log("LoggerProvider.flush - END   - " + new Date().toISOString() + " - flush took " + (t2 - t1) + " ms");
    }
}

async function signUrl(url: string): Promise<string> {
    const locator = new S3Locator({ url });

    const command = new GetObjectCommand({
        Bucket: locator.bucket,
        Key: locator.key,
    });
    return await getSignedUrl(s3Client, command, { expiresIn: 12 * 3600 });
}

async function signMediaAssetUrls(mediaAsset: MediaAsset) {
    if (mediaAsset.thumbnailUrl) {
        mediaAsset.thumbnailUrl = await signUrl(mediaAsset.thumbnailUrl);
    }
    if (mediaAsset.videoUrl) {
        mediaAsset.videoUrl = await signUrl(mediaAsset.videoUrl);
    }
}
