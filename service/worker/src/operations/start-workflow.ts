import { v4 as uuidv4 } from "uuid";

import { ProviderCollection, WorkerRequest } from "@mcma/worker";
import { JobParameterBag, JobStatus, McmaException, McmaTracker, NotificationEndpoint, ProblemDetail, WorkflowJob } from "@mcma/core";
import { MediaAsset, MediaAssetWorkflow, MediaWorkflowProperties, MediaWorkflowType } from "@local/model";
import { DataController } from "@local/data";

import { getJobProfileId } from "./utils";

export async function startWorkflow(providers: ProviderCollection, workerRequest: WorkerRequest, context: { requestId: string, dataController: DataController }) {
    const logger = workerRequest.logger;
    const dataController = context.dataController;
    const resourceManager = providers.resourceManagerProvider.get();

    const mediaWorkflow: MediaWorkflowProperties = workerRequest.input.mediaWorkflow;

    try {
        let title;
        let mediaAssetWorkflowId;
        if (mediaWorkflow.type === MediaWorkflowType.MediaIngest) {
            title = mediaWorkflow.input.title;
        } else if (mediaWorkflow.mediaAssetId) {
            const asset = await dataController.get<MediaAsset>(mediaWorkflow.mediaAssetId);
            title = asset.title;

            const mediaAssetWorkflow = await dataController.createMediaAssetWorkflow(mediaWorkflow.mediaAssetId, new MediaAssetWorkflow({
                mediaWorkflowId: mediaWorkflow.id,
                mediaWorkflowType: mediaWorkflow.type,
            }));

            mediaAssetWorkflowId = mediaAssetWorkflow.id;
        } else {
            throw new McmaException("Missing property mediaAssetId on MediaWorkflow");
        }

        const label = `${mediaWorkflow.type} for ${title}`;

        logger.info(`Creating ${label}`);

        let job = new WorkflowJob({
            parentId: mediaWorkflow.id,
            jobProfileId: await getJobProfileId(resourceManager, mediaWorkflow.type + "Workflow"),
            jobInput: new JobParameterBag(Object.assign({
                mediaWorkflowId: mediaWorkflow.id,
                mediaAssetId: mediaWorkflow.mediaAssetId,
                mediaAssetWorkflowId,
            }, mediaWorkflow.input)),
            tracker: new McmaTracker({
                id: uuidv4(),
                label
            }),
            notificationEndpoint: new NotificationEndpoint({
                httpEndpoint: mediaWorkflow.id + "/notifications"
            })
        });

        job = await resourceManager.create(job);

        mediaWorkflow.mediaAssetTitle = title;
        mediaWorkflow.workflowJobId = job.id;

        await dataController.put(mediaWorkflow.id, mediaWorkflow);
    } catch (error) {
        logger.error("Failed to start workflow");
        logger.error(error);

        mediaWorkflow.status = JobStatus.Failed;
        mediaWorkflow.error = new ProblemDetail({
            type: "uri://mam-tool.mcma.io/rfc7807/failed-to-start-workflow",
            title: "Failed to start workflow",
            detail: "Failed to determine asset for to be used for workflow",
        });
        await dataController.put(mediaWorkflow.id, mediaWorkflow);
    }
}
