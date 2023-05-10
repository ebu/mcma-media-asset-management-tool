import { APIGatewayEventDefaultAuthorizerContext, APIGatewayEventRequestContextWithAuthorizer, Context, ScheduledEvent } from "aws-lambda";
import * as AWSXRay from "aws-xray-sdk-core";
import { ApiGatewayManagementApiClient, GoneException, PostToConnectionCommand } from "@aws-sdk/client-apigatewaymanagementapi";
import { CloudWatchEventsClient } from "@aws-sdk/client-cloudwatch-events";
import { CloudWatchLogsClient } from "@aws-sdk/client-cloudwatch-logs";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";

import { AwsCloudWatchLoggerProvider, getLogGroupName } from "@mcma/aws-logger";
import { DynamoDbTableProvider } from "@mcma/aws-dynamodb";
import { getTableName, Query } from "@mcma/data";

import { disableEventRule, enableEventRule } from "@local/data";

const { CLOUD_WATCH_EVENT_RULE } = process.env;

const cloudWatchEventsClient = AWSXRay.captureAWSv3Client(new CloudWatchEventsClient({}));
const cloudWatchLogsClient = AWSXRay.captureAWSv3Client(new CloudWatchLogsClient({}));
const dynamoDBClient = AWSXRay.captureAWSv3Client(new DynamoDBClient({}));

const loggerProvider = new AwsCloudWatchLoggerProvider("mam-service-websocket-ping", getLogGroupName(), cloudWatchLogsClient);
const dbTableProvider = new DynamoDbTableProvider({}, dynamoDBClient);

export async function handler(event: ScheduledEvent, context: Context) {
    console.log(JSON.stringify(event, null, 2));
    console.log(JSON.stringify(context, null, 2));

    const logger = loggerProvider.get(context.awsRequestId);
    try {
        logger.functionStart(context.awsRequestId);
        logger.debug(event);
        logger.debug(context);

        const table = await dbTableProvider.get(getTableName());

        await disableEventRule(CLOUD_WATCH_EVENT_RULE, table, cloudWatchEventsClient, context.awsRequestId, logger);

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
            try {
                const postCalls = connections.map(async (connection) => {
                    const managementApiClient = AWSXRay.captureAWSv3Client(new ApiGatewayManagementApiClient({
                        endpoint: `https://${connection.domainName}/${connection.stage}`
                    }));

                    try {
                        await managementApiClient.send(new PostToConnectionCommand({
                            ConnectionId: connection.connectionId,
                            Data: new TextEncoder().encode(JSON.stringify({ operation: "Ping" })),
                        }));
                    } catch (e) {
                        if (e instanceof GoneException) {
                            logger.info("Removing stale connection " + connection.connectionId);
                            await table.delete("/connections/" + connection.connectionId);
                        } else {
                            throw e;
                        }
                    }
                });

                await Promise.all(postCalls);
            } finally {
                await enableEventRule(CLOUD_WATCH_EVENT_RULE, table, cloudWatchEventsClient, context.awsRequestId, logger);
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
