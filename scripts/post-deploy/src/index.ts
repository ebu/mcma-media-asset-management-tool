import * as fs from "fs";
import { Utils } from "@mcma/core";
import { fromIni } from "@aws-sdk/credential-providers";
import {
    CloudFrontClient,
    CreateInvalidationCommand,
    GetInvalidationCommand,
    GetInvalidationCommandOutput
} from "@aws-sdk/client-cloudfront";

const TERRAFORM_OUTPUT = "../../deployment/terraform.output.json";

const credentialProvider = fromIni();

const cloudFrontClient = new CloudFrontClient({ credentials: credentialProvider });

export function log(entry?: any) {
    if (typeof entry === "object") {
        console.log(JSON.stringify(entry, null, 2));
    } else {
        console.log(entry);
    }
}

async function invalidateCloudFront(cloudfrontDistributionId: string, websiteUrl: string) {
    if (cloudfrontDistributionId) {
        log(`Invalidating CloudFront Distribution ${cloudfrontDistributionId} for '${websiteUrl}'`);
        const response = await cloudFrontClient.send(new CreateInvalidationCommand({
            DistributionId: cloudfrontDistributionId,
            InvalidationBatch: {
                Paths: {
                    Quantity: 1,
                    Items: ["/*"]
                },
                CallerReference: new Date().toISOString()
            }
        }));

        let getInvalidationResponse: GetInvalidationCommandOutput;
        do {
            await Utils.sleep(5000);
            getInvalidationResponse = await cloudFrontClient.send(new GetInvalidationCommand({
                Id: response.Invalidation.Id,
                DistributionId: cloudfrontDistributionId,
            }));

            log(`Invalidating CloudFront Distribution ${cloudfrontDistributionId} for '${websiteUrl}' - ${getInvalidationResponse.Invalidation.Status}`);
        } while (getInvalidationResponse.Invalidation.Status !== "Completed");
    }
}

async function main() {
    try {
        const terraformOutput = JSON.parse(fs.readFileSync(TERRAFORM_OUTPUT, "utf8"));

        const websiteCloudfrontDistributionId = terraformOutput.website?.value?.cloudfront_distribution_id;
        const websiteUrl = terraformOutput.website?.value?.url;

        await invalidateCloudFront(websiteCloudfrontDistributionId, websiteUrl);
    } catch (error) {
        if (error.response && error.response.data) {
            console.error(JSON.stringify(error.response.data, null, 2));
        } else {
            console.error(error);
        }
    }
}

main().then(() => console.log("Done"));
