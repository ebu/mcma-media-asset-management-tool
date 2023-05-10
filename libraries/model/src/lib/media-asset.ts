import { McmaResource, McmaResourceProperties, Utils } from "@mcma/core";

export interface MediaAssetProperties extends McmaResourceProperties {
    title: string;
    description: string;
    thumbnailUrl?: string;
    videoUrl?: string;
}

export class MediaAsset extends McmaResource implements MediaAssetProperties {
    title: string;
    description: string;
    thumbnailUrl?: string;
    videoUrl?: string;

    constructor(properties: MediaAssetProperties) {
        super("MediaAsset", properties);

        this.title = properties.title;
        this.description = properties.description;
        this.thumbnailUrl = properties.thumbnailUrl;
        this.videoUrl = properties.videoUrl;

        Utils.checkProperty(this, "title", "string", true);
        Utils.checkProperty(this, "description", "string", true);
        Utils.checkProperty(this, "thumbnailUrl", "string", false);
        Utils.checkProperty(this, "videoUrl", "string", false);
    }
}
