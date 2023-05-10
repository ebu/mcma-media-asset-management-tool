import { S3Client } from "@aws-sdk/client-s3";
import { CognitoAuthService } from "../cognito-auth";
import { LoggerService } from "../../services";
import { map } from "rxjs/operators";
import { XhrHttpHandler } from "@aws-sdk/xhr-http-handler";
import { Provider, AwsCredentialIdentity } from "@aws-sdk/types";

export class S3ClientProvider {
  private s3Client: S3Client | undefined;
  private expireTime: number;
  private generating: boolean;

  constructor(private auth: CognitoAuthService,
              private logger: LoggerService,
              private region: string,
              credentials: Provider<AwsCredentialIdentity>) {
    this.expireTime = 0;
    this.generating = false;
    this.generateS3(credentials);
  }

  async get(): Promise<S3Client> {
    while (this.generating) {
      await new Promise<void>(resolve => setTimeout(() => resolve(), 100));
    }

    if (this.s3Client && this.expireTime > Date.now()) {
      return this.s3Client;
    }

    this.generating = true;
    return this.auth.getCredentialsProvider().pipe(
      map((credentials) => this.generateS3(credentials))
    ).toPromise().finally(() => {
      this.generating = false;
    });
  }

  private generateS3(credentials: Provider<AwsCredentialIdentity>) {
    this.expireTime = Date.now() + 5 * 60 * 1000; // 5 minutes
    return this.s3Client = new S3Client({
      credentials,
      region: this.region,
      requestHandler: new XhrHttpHandler(),
      useAccelerateEndpoint: true
    });
  }
}
