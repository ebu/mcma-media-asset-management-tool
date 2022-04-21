import { DocumentDatabaseTable } from "@mcma/data";
import { S3 } from "aws-sdk";
import { S3Locator } from "@mcma/aws-s3";

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

export function signUrl(url: string, s3: S3): string {
    const locator = new S3Locator({ url });
    return s3.getSignedUrl("getObject", {
        Bucket: locator.bucket,
        Key: locator.key,
        Expires: 12 * 3600
    });
}
