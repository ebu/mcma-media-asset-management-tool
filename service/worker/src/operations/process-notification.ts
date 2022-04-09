import { ProviderCollection, WorkerRequest } from "@mcma/worker";
import { Notification } from "@mcma/core";

import { MediaWorkflowProperties } from "@local/model";
import { DataController } from "@local/data";

const { AWS_REGION } = process.env;

export async function processNotification(providers: ProviderCollection, workerRequest: WorkerRequest, context: { requestId: string, dataController: DataController }) {
    const logger = workerRequest.logger;
    const dataController = context.dataController;

    const mediaWorkflowDatabaseId = workerRequest.input.mediaWorkflowDatabaseId;
    const notification: Notification = workerRequest.input.notification;
    const workflowJob = notification.content;

    const mediaWorkflow = await dataController.get<MediaWorkflowProperties>(mediaWorkflowDatabaseId);

    mediaWorkflow.status = workflowJob.status;
    mediaWorkflow.error = workflowJob.error;
    if (workflowJob.jobOutput && workflowJob.jobOutput["executionArn"]) {
        const executionArn = workflowJob.jobOutput["executionArn"];
        mediaWorkflow.detailUrl = `https://${AWS_REGION}.console.aws.amazon.com/states/home?region=${AWS_REGION}#/executions/details/${executionArn}`
    }

    dataController.put(mediaWorkflow.id, mediaWorkflow);
    logger.info(`Updated media workflow ${mediaWorkflowDatabaseId}`);
    logger.info(mediaWorkflow);
}
