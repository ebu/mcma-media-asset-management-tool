import * as mime from "mime-types";
import { AbortController } from "@aws-sdk/abort-controller";
import { HttpRequest } from "@aws-sdk/protocol-http";
import {
  AbortMultipartUploadCommand,
  CompleteMultipartUploadCommand,
  CreateMultipartUploadCommand,
  PutObjectCommand,
  ServiceOutputTypes,
  UploadPartCommand
} from "@aws-sdk/client-s3";
import { EventEmitter } from "events";

import { interval, Observable, Subscriber } from "rxjs";
import { LoggerService } from "../../services";
import { FileDescriptor, UploadStatus } from "../../model";
import { S3ClientProvider } from "./s3-client-provider";

const MIN_MULTIPART_SIZE = 67108864; // 64 MB
const MAX_NUMBER_PARTS = 10000;

enum WorkType {
  Prepare,
  Single,
  MultipartStart,
  MultipartSegment,
  MultipartComplete,
  MultipartAbort
}

interface MultipartSegment {
  partNumber: number;
  start: number;
  end: number;
  length: number;
  uploaded: number;
  etag?: string;
}

interface WorkItem {
  type: WorkType;
  path: string;
  key: string;
  contentType: string;
  file: File;
  singleData?: {
    length: number
    uploaded: number
  };
  multipartData?: {
    uploadId: string
    segment?: MultipartSegment
    segments?: MultipartSegment[]
  };
}

interface ActiveWorkItem {
  workItem: WorkItem;
  promise: Promise<ServiceOutputTypes>;
  abortController: AbortController;
  result?: any;
  error?: any;
}

export class S3FileUploader {
  private readonly subscribers: Subscriber<UploadStatus>[] = [];

  private readonly queuedWorkItems: WorkItem[] = [];
  private readonly activeWorkItems: ActiveWorkItem[] = [];

  private canceled: boolean = false;
  private running: boolean = false;
  private processing: boolean = false;

  private filenames: string[] = [];
  private totalFiles: number = 0;
  private uploadedFiles: number = 0;
  private totalBytes: number = 0;
  private uploadedBytes: number = 0;

  private _maxConcurrentRequests = 6;

  constructor(public bucket: string,
              public identityId: string,
              private s3ClientProvider: S3ClientProvider,
              private logger: LoggerService) {
  }

  get maxConcurrentRequests(): number {
    return this._maxConcurrentRequests;
  }

  set maxConcurrentRequests(value: number) {
    if (value < 0) {
      value = 0;
    } else if (value > 6) {
      value = 6;
    }

    this._maxConcurrentRequests = value << 0;
  }

  public uploadFiles(targetFolder: string, files: FileDescriptor[]): Observable<UploadStatus> {
    if (!targetFolder.startsWith("/")) {
      targetFolder = "/" + targetFolder;
    }
    if (!targetFolder.endsWith("/")) {
      targetFolder += "/";
    }

    for (const file of files) {
      this.queueFile(targetFolder, file);
    }

    return this.createUploadStatusObservable();
  }

  private createUploadStatusObservable(): Observable<UploadStatus> {
    return new Observable<UploadStatus>(subscriber => {
      if (this.subscribers.length === 0) {
        this.start();
      }

      this.subscribers.push(subscriber);

      subscriber.add(() => {
        let idx = this.subscribers.indexOf(subscriber);
        if (idx >= 0) {
          this.subscribers.splice(idx, 1);
        }

        if (this.running && this.subscribers.length === 0) {
          this.cancel();
        }
      });
    });
  }

  private queueFile(targetFolder: string, fileDescriptor: FileDescriptor) {
    this.logger.info(fileDescriptor);

    this.queuedWorkItems.push({
      type: WorkType.Prepare,
      path: fileDescriptor.path,
      key: this.identityId + targetFolder + fileDescriptor.path,
      contentType: mime.lookup(fileDescriptor.path) || "application/octet-stream",
      file: fileDescriptor.file,
    });

    this.totalFiles += 1;
    this.totalBytes += fileDescriptor.file.size;

    this.process();
  }

  private start() {
    if (this.running) {
      return;
    }

    this.logger.info("Start processing");

    this.startStatusDispatcher();

    this.running = true;
    this.process();
  }

  private cancel() {
    this.logger.info("Cancel processing");

    this.maxConcurrentRequests = 6;
    this.canceled = true;
    this.filenames = [];

    const abortWorkItems: WorkItem[] = [];

    for (const activeWorkItem of this.activeWorkItems) {
      activeWorkItem?.abortController.abort();
    }

    while (this.queuedWorkItems.length > 0) {
      const workItem = this.queuedWorkItems.shift();

      if (workItem?.type === WorkType.MultipartComplete) {
        workItem.type = WorkType.MultipartAbort;
        abortWorkItems.push(workItem);
      }
    }

    this.queuedWorkItems.push(...abortWorkItems);

    this.process();
  }

  private startStatusDispatcher() {
    const statusTimerSubscription = interval(100).subscribe(() => {
      for (const subscriber of this.subscribers) {
        subscriber.next({
          filename: this.filenames[0] ?? "",
          totalFiles: this.totalFiles,
          uploadedFiles: this.uploadedFiles,
          totalBytes: this.totalBytes,
          uploadedBytes: this.uploadedBytes,
        });

        if (this.uploadedFiles >= this.totalFiles || this.canceled) {
          this.logger.info("Completed processing");
          this.running = false;

          statusTimerSubscription.unsubscribe();

          for (const subscriber of this.subscribers) {
            subscriber.complete();
          }
        }
      }
    });
  }

  private async process() {
    if (!this.running) {
      return;
    }

    if (this.processing) {
      return;
    }

    this.processing = true;
    this.logger.info("Start processing");

    try {
      while (this.running && (this.queuedWorkItems.length > 0 || this.activeWorkItems.length > 0)) {
        if ((this.activeWorkItems.length >= this._maxConcurrentRequests || this.queuedWorkItems.length === 0) && this.activeWorkItems.length > 0) {
          const activeWorkItem = await Promise.race(this.activeWorkItems.map(activeWorkItem =>
            activeWorkItem.promise.then(result => {
              activeWorkItem.result = result;
              return activeWorkItem;
            }).catch(error => {
              activeWorkItem.error = error;
              return activeWorkItem;
            })
          ));
          const idx = this.activeWorkItems.indexOf(activeWorkItem);
          this.activeWorkItems.splice(idx, 1);

          switch (activeWorkItem.workItem.type) {
            case WorkType.Single:
              this.finishWorkItemSingle(activeWorkItem);
              break;
            case WorkType.MultipartStart:
              this.finishWorkItemMultipartStart(activeWorkItem);
              break;
            case WorkType.MultipartSegment:
              this.finishWorkItemMultipartSegment(activeWorkItem);
              break;
            case WorkType.MultipartComplete:
              this.finishWorkItemMultipartComplete(activeWorkItem);
              break;
            case WorkType.MultipartAbort:
              this.finishWorkItemMultipartAbort(activeWorkItem);
          }
        }

        if (this.queuedWorkItems.length > 0 && this.activeWorkItems.length < this._maxConcurrentRequests) {
          const workItem = this.queuedWorkItems.shift();
          try {
            switch (workItem?.type) {
              case WorkType.Prepare:
                await this.processWorkItemPrepare(workItem);
                break;
              case WorkType.Single:
                await this.processWorkItemSingle(workItem);
                break;
              case WorkType.MultipartStart:
                await this.processWorkItemMultipartStart(workItem);
                break;
              case WorkType.MultipartSegment:
                await this.processWorkItemMultipartSegment(workItem);
                break;
              case WorkType.MultipartComplete:
                await this.processWorkItemMultipartComplete(workItem);
                break;
              case WorkType.MultipartAbort:
                await this.processWorkItemMultipartAbort(workItem);
                break;
            }
          } catch (error) {
            this.logger.error("Detected error in S3FileUploader.process()");
            this.logger.error(error);
            this._maxConcurrentRequests = 0;
            if (workItem) {
              this.queuedWorkItems.unshift(workItem);
            }
          }
        } else {
          await new Promise<void>(resolve => setTimeout(resolve, 250));
        }
      }
    } finally {
      this.processing = false;
      this.logger.info("End processing");
    }
  }

  private async processWorkItemPrepare(workItem: WorkItem) {
    this.logger.info("processWorkItemPrepare - " + workItem.key);
    if (workItem.file.size < MIN_MULTIPART_SIZE * 2) {
      workItem.type = WorkType.Single;
    } else {
      workItem.type = WorkType.MultipartStart;
    }
    this.queuedWorkItems.push(workItem);
    this.filenames.push(workItem.path);
  }

  private async processWorkItemSingle(workItem: WorkItem) {
    this.logger.info("processWorkItemSingle - " + workItem.key);
    const singleData = {
      length: workItem.file.size,
      uploaded: 0,
    };
    workItem.singleData = singleData;

    const s3Client = await this.s3ClientProvider.get();

    const requestHandler = s3Client.config.requestHandler;
    const eventEmitter: EventEmitter | null = requestHandler instanceof EventEmitter ? requestHandler : null;

    const uploadEventListener = (event: ProgressEvent, request: HttpRequest) => {
      const key = decodeURIComponent(request.path).substring(1);

      if (key !== workItem.key) {
        // ignored, because the emitted event is not for this part.
        return;
      }

      const diff = event.loaded - singleData.uploaded;
      singleData.uploaded = event.loaded;
      this.uploadedBytes += diff;
    };

    if (eventEmitter !== null) {
      // The requestHandler is the xhr-http-handler.
      eventEmitter.on("xhr.upload.progress", uploadEventListener);
    }

    const abortController = new AbortController();

    const promise = s3Client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: workItem.key,
        Body: workItem.file,
        ContentType: workItem.contentType
      }), {
        abortSignal: abortController.signal
      }
    ).then(value => {
      if (eventEmitter !== null) {
        eventEmitter.off("xhr.upload.progress", uploadEventListener);
      }
      return value;
    });

    this.activeWorkItems.push({
      workItem,
      promise,
      abortController
    });
  }

  private finishWorkItemSingle(activeWorkItem: ActiveWorkItem) {
    this.logger.info("finishWorkItemSingle - " + activeWorkItem.workItem.key);

    if (activeWorkItem.error) {
      this.logger.error(activeWorkItem.error);
      if (!this.canceled) {
        this.queuedWorkItems.push(activeWorkItem.workItem);
      }
    } else {
      this.filenames.splice(this.filenames.indexOf(activeWorkItem.workItem.path), 1);
      this.uploadedFiles += 1;
      const singleData = activeWorkItem.workItem.singleData;
      if (singleData) {
        const diff = singleData.length - singleData.uploaded;
        singleData.uploaded = singleData.length;
        this.uploadedBytes += diff;
      }
    }
  }

  private async processWorkItemMultipartStart(workItem: WorkItem) {
    this.logger.info("processWorkItemMultipartStart - " + workItem.key);

    const s3Client = await this.s3ClientProvider.get();

    const abortController = new AbortController();

    const promise = s3Client.send(
      new CreateMultipartUploadCommand({
        Bucket: this.bucket,
        Key: workItem.key,
        ContentType: workItem.contentType,
      }), {
        abortSignal: abortController.signal
      }
    );

    this.activeWorkItems.push({
      workItem,
      promise,
      abortController
    });
  }

  private finishWorkItemMultipartStart(activeWorkItem: ActiveWorkItem) {
    this.logger.info("finishWorkItemMultipartStart - " + activeWorkItem.workItem.key);

    if (activeWorkItem.error) {
      this.logger.error(activeWorkItem.error);
      if (!this.canceled) {
        this.queuedWorkItems.push(activeWorkItem.workItem);
      }
    } else {
      const uploadId = activeWorkItem.result.UploadId;
      const objectSize = activeWorkItem.workItem.file.size;

      let multipartSize = MIN_MULTIPART_SIZE;
      while (multipartSize * MAX_NUMBER_PARTS < objectSize) {
        multipartSize *= 2;
      }

      const segments: MultipartSegment[] = [];

      let bytePosition = 0;
      for (let partNumber = 1; bytePosition < objectSize; partNumber++) {
        const start = bytePosition;
        const end = (bytePosition + multipartSize >= objectSize ? objectSize : bytePosition + multipartSize);
        const length = end - start;

        const segment: MultipartSegment = {
          partNumber,
          start,
          end,
          length,
          uploaded: 0
        };

        const segmentWorkItem: WorkItem = {
          type: WorkType.MultipartSegment,
          path: activeWorkItem.workItem.path,
          key: activeWorkItem.workItem.key,
          file: activeWorkItem.workItem.file,
          contentType: activeWorkItem.workItem.contentType,
          multipartData: {
            uploadId,
            segment
          }
        };

        segments.push(segment);

        bytePosition += length;

        this.queuedWorkItems.push(segmentWorkItem);
      }

      const completeWorkItem: WorkItem = {
        type: WorkType.MultipartComplete,
        path: activeWorkItem.workItem.path,
        key: activeWorkItem.workItem.key,
        file: activeWorkItem.workItem.file,
        contentType: activeWorkItem.workItem.contentType,
        multipartData: {
          uploadId,
          segments
        }
      };

      this.queuedWorkItems.push(completeWorkItem);
    }
  }

  private async processWorkItemMultipartSegment(workItem: WorkItem) {
    this.logger.info("processWorkItemMultipartSegment - " + workItem.key + " - " + workItem.multipartData?.segment?.partNumber);
    const uploadId = workItem.multipartData?.uploadId;
    if (!uploadId) {
      throw Error("Missing upload id");
    }

    const segment = workItem?.multipartData?.segment;
    if (!segment) {
      throw Error("Missing segment");
    }

    this.logger.info(segment);

    const s3Client = await this.s3ClientProvider.get();

    const requestHandler = s3Client.config.requestHandler;
    const eventEmitter: EventEmitter | null = requestHandler instanceof EventEmitter ? requestHandler : null;

    const uploadEventListener = (event: ProgressEvent, request: HttpRequest) => {
      const key = decodeURIComponent(request.path).substring(1);

      if (key !== workItem.key) {
        // ignored, because the emitted event is not for this part.
        return;
      }

      const partNumber = Number(request.query["partNumber"]) || -1;
      if (partNumber !== segment.partNumber) {
        // ignored, because the emitted event is not for this part.
        return;
      }

      const diff = event.loaded - segment.uploaded;
      segment.uploaded = event.loaded;
      this.uploadedBytes += diff;
    };

    if (eventEmitter !== null) {
      // The requestHandler is the xhr-http-handler.
      eventEmitter.on("xhr.upload.progress", uploadEventListener);
    }

    const abortController = new AbortController();

    const promise = s3Client.send(
      new UploadPartCommand({
        Bucket: this.bucket,
        Key: workItem.key,
        PartNumber: segment.partNumber,
        UploadId: uploadId,
        ContentLength: segment.length,
        Body: workItem.file.slice(segment.start, segment.end),
      }), {
        abortSignal: abortController.signal
      }
    ).then(value => {
      if (eventEmitter !== null) {
        eventEmitter.off("xhr.upload.progress", uploadEventListener);
      }
      return value;
    });

    this.activeWorkItems.push({
      workItem,
      promise,
      abortController
    });
  }

  private finishWorkItemMultipartSegment(activeWorkItem: ActiveWorkItem) {
    this.logger.info("finishWorkItemMultipartSegment - " + activeWorkItem.workItem.key + " - " + activeWorkItem.workItem.multipartData?.segment?.partNumber);

    if (activeWorkItem.error) {
      this.logger.error(activeWorkItem.error);
      if (!this.canceled) {
        this.queuedWorkItems.push(activeWorkItem.workItem);
      }
    } else {
      const segment = activeWorkItem.workItem.multipartData?.segment;
      if (segment) {
        segment.etag = activeWorkItem.result.ETag;
        const diff = segment.length - segment.uploaded;
        segment.uploaded = segment.length;
        this.uploadedBytes += diff;
      }
    }
  }

  private async processWorkItemMultipartComplete(workItem: WorkItem) {
    this.logger.info("processWorkItemMultipartComplete - " + workItem.key);

    const uploadId = workItem.multipartData?.uploadId;
    if (!uploadId) {
      throw Error("Missing upload id");
    }

    const segments = workItem?.multipartData?.segments;
    if (!segments) {
      throw Error("Missing segments");
    }

    const hasUnfinishedSegment = !!segments.find(s => !s.etag);

    if (hasUnfinishedSegment) {
      setTimeout(() => {
        this.queuedWorkItems.unshift(workItem);
        this.process();
      }, 1000);
    } else {
      const s3Client = await this.s3ClientProvider.get();

      const abortController = new AbortController();

      const promise = s3Client.send(
        new CompleteMultipartUploadCommand({
          Bucket: this.bucket,
          Key: workItem.key,
          UploadId: uploadId,
          MultipartUpload: {
            Parts: segments.map(segment => {
              return {
                ETag: segment.etag,
                PartNumber: segment.partNumber,
              };
            }).sort((a, b) => a.PartNumber - b.PartNumber)
          }
        }), {
          abortSignal: abortController.signal
        }
      );

      this.activeWorkItems.push({
        workItem,
        promise,
        abortController,
      });
    }
  }

  private finishWorkItemMultipartComplete(activeWorkItem: ActiveWorkItem) {
    this.logger.info("finishWorkItemMultipartComplete - " + activeWorkItem.workItem.key);

    if (activeWorkItem.error) {
      this.logger.error(activeWorkItem.error);
      if (!this.canceled) {
        this.queuedWorkItems.push(activeWorkItem.workItem);
      }
    } else {
      this.filenames.splice(this.filenames.indexOf(activeWorkItem.workItem.path), 1);
      this.uploadedFiles += 1;
    }
  }

  private async processWorkItemMultipartAbort(workItem: WorkItem) {
    this.logger.info("processWorkItemMultipartAbort - " + workItem.key);

    const uploadId = workItem.multipartData?.uploadId;
    if (!uploadId) {
      throw Error("Missing upload id");
    }

    const s3Client = await this.s3ClientProvider.get();

    const abortController = new AbortController();

    const promise = s3Client.send(
      new AbortMultipartUploadCommand({
        Bucket: this.bucket,
        Key: workItem.key,
        UploadId: uploadId
      }), {
        abortSignal: abortController.signal
      }
    );

    this.activeWorkItems.push({
      workItem,
      promise,
      abortController,
    });
  }

  private finishWorkItemMultipartAbort(activeWorkItem: ActiveWorkItem) {
    this.logger.info("finishWorkItemMultipartAbort - " + activeWorkItem.workItem.key);

    if (activeWorkItem.error) {
      this.logger.error(activeWorkItem.error);
    }
  }
}
