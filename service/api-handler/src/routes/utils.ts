import { DocumentDatabaseTable } from "@mcma/data";
import { S3Locator } from "@mcma/aws-s3";
import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export async function parentResourceExists(path: string, dbTable: DocumentDatabaseTable): Promise<boolean> {
    const pathComponents = path.split("/").filter(c => c !== "");

    let parentPath = "";
    for (let i = 0; i < pathComponents.length - 1; i = i + 2) {
        parentPath += "/" + pathComponents[i] + "/" + pathComponents[i + 1];
    }

    if (parentPath === "") {
        return true;
    }

    const parentProperties = await dbTable.get(parentPath);
    return !!parentProperties;
}

export async function signUrl(url: string, s3Client: S3Client): Promise<string> {
    const locator = new S3Locator({ url });
    const command = new GetObjectCommand({
        Bucket: locator.bucket,
        Key: locator.key,
    });
    return await getSignedUrl(s3Client, command, { expiresIn: 12 * 3600 });
}
