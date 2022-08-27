import { JobStatus, McmaResource, McmaResourceProperties, ProblemDetail, ProblemDetailProperties, Utils } from "@mcma/core";

export enum MediaWorkflowType {
    MediaIngest = "MediaIngest",
    AwsCelebrityRecognition = "AwsCelebrityRecognition",
    AwsFaceDetection = "AwsFaceDetection",
    AwsLabelDetection = "AwsLabelDetection",
    AwsTranscription = "AwsTranscription",
    AzureTranscription = "AzureTranscription",
    GoogleTranscription = "GoogleTranscription",
}

export interface MediaWorkflowProperties extends McmaResourceProperties {
    type: MediaWorkflowType;
    input: { [key: string]: any };
    status?: JobStatus;
    error?: ProblemDetailProperties;
    mediaAssetId?: string;
    mediaAssetTitle?: string;
    mediaAssetWorkflowId?: string;
    workflowJobId?: string;
    detailUrl?: string;
}

export class MediaWorkflow extends McmaResource implements MediaWorkflowProperties {
    type: MediaWorkflowType;
    input: { [key: string]: any };
    status: JobStatus;
    error?: ProblemDetail;
    mediaAssetId?: string;
    mediaAssetTitle?: string;
    mediaAssetWorkflowId?: string;
    workflowJobId?: string;
    detailUrl?: string;

    constructor(properties: MediaWorkflowProperties) {
        super("MediaWorkflow", properties);

        Utils.checkProperty(this, "type", "string", true);
        Utils.checkProperty(this, "input", "object", true);
        Utils.checkProperty(this, "status", "string", false);
        Utils.checkProperty(this, "error", "object", false);
        Utils.checkProperty(this, "mediaAssetId", "url", false);
        Utils.checkProperty(this, "mediaAssetTitle", "string", false);
        Utils.checkProperty(this, "mediaAssetWorkflowId", "url", false);
        Utils.checkProperty(this, "workflowJobId", "url", false);
        Utils.checkProperty(this, "detailUrl", "url", false);

        if (!this.status) {
            this.status = JobStatus.New;
        }
        if (typeof this.error === "object") {
            this.error = new ProblemDetail(this.error);
        }
    }
}

export interface MediaAssetWorkflowProperties extends McmaResourceProperties {
    mediaWorkflowType: MediaWorkflowType;
    mediaWorkflowId: string;
    data?: { [key: string]: any };
}

export class MediaAssetWorkflow extends McmaResource implements MediaAssetWorkflowProperties {
    mediaWorkflowType: MediaWorkflowType;
    mediaWorkflowId: string;
    data: { [key: string]: any };

    constructor(properties: MediaAssetWorkflowProperties) {
        super("MediaAssetWorkflow", properties);

        Utils.checkProperty(this, "mediaWorkflowType", "string", true);
        Utils.checkProperty(this, "mediaWorkflowId", "url", true);
        Utils.checkProperty(this, "data", "object", false);

        if (!this.data) {
            this.data = {};
        }
    }
}
