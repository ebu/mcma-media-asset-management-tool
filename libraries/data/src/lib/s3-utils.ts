import {
    AbortMultipartUploadCommand, CompleteMultipartUploadCommand, CreateMultipartUploadCommand, HeadObjectCommand, S3Client, UploadPartCopyCommand, UploadPartCopyCommandOutput } from "@aws-sdk/client-s3"

interface PartRequest {
    Bucket: string
    Key: string
    CopySource: string
    CopySourceRange: string
    PartNumber: number
    UploadId: string,
    promise?: Promise<UploadPartCopyCommandOutput>,
    result?: UploadPartCopyCommandOutput,
    error?: any,
}

async function finishUploadPart(uploadingRequests: PartRequest[], finishedRequests: PartRequest[], errorRequests: PartRequest[]) {
    const request = await Promise.race(uploadingRequests.map(request =>
        request.promise.then((result: UploadPartCopyCommandOutput) => {
            request.result = result;
            return request;
        }).catch((error: any) => {
            request.error = error;
            return request;
        })
    ));

    if (request.result) {
        finishedRequests.push(request);
    } else {
        errorRequests.push(request);
    }

    let idx = uploadingRequests.indexOf(request);
    uploadingRequests.splice(idx, 1);
}

export async function multipartCopy(source: { bucket: string, key: string }, target: { bucket: string, key: string }, s3Client?: S3Client, options?: { multipartSize: number, maxConcurrentTransfers: number }) {
    let multipartSize: number = options?.multipartSize;
    let maxConcurrentTransfers: number = options?.maxConcurrentTransfers;

    if (typeof maxConcurrentTransfers !== "number" || maxConcurrentTransfers < 1) {
        maxConcurrentTransfers = 64;
    }

    if ((typeof multipartSize !== "number") || multipartSize < 5242880 || multipartSize > 5368709120) {
        multipartSize = 64 * 1024 * 1024;
    }

    const createResponse = await s3Client.send(new CreateMultipartUploadCommand({
        Bucket: target.bucket,
        Key: target.key
    }));

    const uploadId = createResponse.UploadId;

    try {
        const metadata = await s3Client.send(new HeadObjectCommand({
            Bucket: source.bucket,
            Key: source.key,
        }));

        const preparedRequests: PartRequest[] = [];
        const uploadingRequests: PartRequest[] = [];
        const finishedRequests: PartRequest[] = [];
        const errorRequests: PartRequest[] = [];

        const objectSize = metadata.ContentLength;

        let bytePosition = 0;
        for (let i = 1; bytePosition < objectSize; i++) {
            const start = bytePosition;
            const end = (bytePosition + multipartSize - 1 >= objectSize ? objectSize - 1 : bytePosition + multipartSize - 1);

            preparedRequests.push({
                Bucket: target.bucket,
                Key: target.key,
                CopySource: encodeURI(source.bucket + "/" + source.key),
                CopySourceRange: "bytes=" + start + "-" + end,
                PartNumber: i,
                UploadId: uploadId
            });

            bytePosition += multipartSize;
        }

        while (preparedRequests.length > 0) {
            if (uploadingRequests.length >= maxConcurrentTransfers) {
                await finishUploadPart(uploadingRequests, finishedRequests, errorRequests);
            }

            const request = preparedRequests.shift();
            request.promise = s3Client.send(new UploadPartCopyCommand(request));
            uploadingRequests.push(request);
        }

        while (uploadingRequests.length > 0) {
            await finishUploadPart(uploadingRequests, finishedRequests, errorRequests);
        }

        if (errorRequests.length > 0) {
            throw new Error("Transfer failed with " + errorRequests.length + " errors");
        }

        const parts = finishedRequests.map(request => {
            return {
                ETag: request.result.CopyPartResult.ETag,
                PartNumber: request.PartNumber,
            };
        });
        parts.sort((a, b) => a.PartNumber - b.PartNumber);

        await s3Client.send(new CompleteMultipartUploadCommand({
            Bucket: target.bucket,
            Key: target.key,
            UploadId: uploadId,
            MultipartUpload: {
                Parts: parts,
            }
        }));
    } catch (error) {
        await s3Client.send(new AbortMultipartUploadCommand({
            Bucket: target.bucket,
            Key: target.key,
            UploadId: uploadId,
        }));
        throw error;
    }
}

