import { JobStatus, McmaResource, McmaResourceProperties, ProblemDetail, ProblemDetailProperties } from "@mcma/core";

export enum MediaWorkflowType {
    MediaIngest = "MediaIngest",
    SpeechToTextAws = "SpeechToTextAws",
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

        this.checkProperty("type", "string", true);
        this.checkProperty("input", "object", true);
        this.checkProperty("status", "string", false);
        this.checkProperty("error", "object", false);
        this.checkProperty("mediaAssetId", "url", false);
        this.checkProperty("mediaAssetTitle", "string", false);
        this.checkProperty("mediaAssetWorkflowId", "url", false);
        this.checkProperty("workflowJobId", "url", false);
        this.checkProperty("detailUrl", "url", false);

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
    data: { [key: string]: any };
}

export class MediaAssetWorkflow extends McmaResource implements MediaAssetWorkflowProperties {
    mediaWorkflowType: MediaWorkflowType;
    mediaWorkflowId: string;
    data: { [key: string]: any };

    constructor(properties: MediaAssetWorkflowProperties) {
        super("MediaAssetWorkflow", properties);

        this.checkProperty("mediaWorkflowType", "string", true);
        this.checkProperty("mediaWorkflowId", "url", true);
        this.checkProperty("data", "object", true);
    }
}
