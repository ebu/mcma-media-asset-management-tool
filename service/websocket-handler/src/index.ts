import { APIGatewayProxyEvent, Context } from "aws-lambda";
import * as AWSXRay from "aws-xray-sdk-core";
import { CloudWatchEventsClient } from "@aws-sdk/client-cloudwatch-events";
import { CloudWatchLogsClient } from "@aws-sdk/client-cloudwatch-logs";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";

import { AwsCloudWatchLoggerProvider, getLogGroupName } from "@mcma/aws-logger";
import { DynamoDbTableProvider } from "@mcma/aws-dynamodb";

import { enableEventRule } from "@local/data";

const { CLOUD_WATCH_EVENT_RULE, MCMA_TABLE_NAME } = process.env;

const cloudWatchEventsClient = AWSXRay.captureAWSv3Client(new CloudWatchEventsClient({}));
const cloudWatchLogsClient = AWSXRay.captureAWSv3Client(new CloudWatchLogsClient({}));
const dynamoDBClient = AWSXRay.captureAWSv3Client(new DynamoDBClient({}));

const loggerProvider = new AwsCloudWatchLoggerProvider("mam-service-websocket-handler", getLogGroupName(), cloudWatchLogsClient);
const dbTableProvider = new DynamoDbTableProvider({}, dynamoDBClient);

export async function handler(event: APIGatewayProxyEvent, context: Context) {
    console.log(JSON.stringify(event, null, 2));
    console.log(JSON.stringify(context, null, 2));

    const logger = loggerProvider.get(context.awsRequestId);
    try {
        logger.functionStart(context.awsRequestId);
        logger.debug(event);
        logger.debug(context);

        const table = await dbTableProvider.get(MCMA_TABLE_NAME);

        switch (event.requestContext.routeKey) {
            case "$connect":
                await table.put("/connections/" + event.requestContext.connectionId, event.requestContext);

                await enableEventRule(CLOUD_WATCH_EVENT_RULE, table, cloudWatchEventsClient, context.awsRequestId, logger);
                break;
            case "$disconnect":
                await table.delete("/connections/" + event.requestContext.connectionId);
                break;
            case "message":
                break;
            default:
                logger.warn(`Unexpected route: ${event.requestContext.routeKey}`);
                break;
        }

        return {
            statusCode: 200
        };
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


