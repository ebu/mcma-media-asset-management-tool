import { Locator, LocatorProperties, McmaResource, McmaResourceProperties, Utils } from "@mcma/core";
import { S3Locator, S3LocatorProperties } from "@mcma/aws-s3";

import {
    AudioTechnicalMetadata,
    AudioTechnicalMetadataProperties,
    ImageTechnicalMetadata,
    ImageTechnicalMetadataProperties,
    VideoTechnicalMetadata,
    VideoTechnicalMetadataProperties
} from "./technical-metadata";

export interface MediaEssenceProperties extends McmaResourceProperties {
    filename?: string;
    extension?: string;
    size?: number;
    duration?: number;
    locators?: LocatorProperties[];
    tags?: string[];
}

export class MediaEssence extends McmaResource implements MediaEssenceProperties {
    filename?: string;
    extension?: string;
    size?: number;
    duration?: number;
    locators: Locator[];
    tags: string[];

    constructor(properties: MediaEssenceProperties);
    constructor(type: string, properties: MediaEssenceProperties);
    constructor(typeOrProperties: string | MediaEssenceProperties, properties?: MediaEssenceProperties) {
        if (!properties && typeof typeOrProperties !== "string") {
            properties = typeOrProperties;
            typeOrProperties = "MediaEssence";
        }
        super(typeOrProperties as string, properties);

        this.filename = properties.filename;
        this.extension = properties.extension?.toLowerCase();
        this.size = properties.size;
        this.duration = properties.duration;
        this.locators = [];
        if (Array.isArray(properties.locators)) {
            for (const locator of properties.locators) {
                if (locator["@type"] === "S3Locator") {
                    this.locators.push(new S3Locator(locator as S3LocatorProperties));
                } else {
                    this.locators.push(new Locator(locator));
                }
            }
        }
        this.tags = [];
        if (Array.isArray(properties.tags)) {
            this.tags.push(...properties.tags);
        }

        Utils.checkProperty(this, "filename", "string", false);
        Utils.checkProperty(this, "extension", "string", false);
        Utils.checkProperty(this, "size", "number", false);
        Utils.checkProperty(this, "duration", "number", false);
    }
}

export interface ImageEssenceProperties extends MediaEssenceProperties {
    imageTechnicalMetadata?: ImageTechnicalMetadataProperties;
}

export class ImageEssence extends MediaEssence implements ImageEssenceProperties {
    imageTechnicalMetadata: ImageTechnicalMetadata;

    constructor(properties: ImageEssenceProperties) {
        super("ImageEssence", properties);

        if (properties.imageTechnicalMetadata) {
            this.imageTechnicalMetadata = new ImageTechnicalMetadata(properties.imageTechnicalMetadata);
        }
    }
}

export interface VideoEssenceProperties extends MediaEssenceProperties {
    audioTechnicalMetadata?: AudioTechnicalMetadataProperties;
    videoTechnicalMetadata?: VideoTechnicalMetadataProperties;
}

export class VideoEssence extends MediaEssence implements VideoEssenceProperties {
    audioTechnicalMetadata: AudioTechnicalMetadata;
    videoTechnicalMetadata: VideoTechnicalMetadata;

    constructor(properties: VideoEssenceProperties) {
        super("VideoEssence", properties);

        if (properties.audioTechnicalMetadata) {
            this.audioTechnicalMetadata = new AudioTechnicalMetadata(properties.audioTechnicalMetadata);
        }
        if (properties.videoTechnicalMetadata) {
            this.videoTechnicalMetadata = new VideoTechnicalMetadata(properties.videoTechnicalMetadata);
        }
    }
}

export interface AudioEssenceProperties extends MediaEssenceProperties {
    audioTechnicalMetadata?: AudioTechnicalMetadataProperties;
}

export class AudioEssence extends MediaEssence implements AudioEssenceProperties {
    audioTechnicalMetadata: AudioTechnicalMetadata;

    constructor(properties: AudioEssenceProperties) {
        super("AudioEssence", properties);

        if (this.audioTechnicalMetadata) {
            this.audioTechnicalMetadata = new AudioTechnicalMetadata(this.audioTechnicalMetadata);
        }
    }
}
