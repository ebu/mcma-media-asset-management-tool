import { Injectable } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { Observable, zip } from "rxjs";
import { filter, map, retry, share, switchMap, tap } from "rxjs/operators";
import { webSocket } from "rxjs/webSocket";
import { McmaResource } from "@mcma/core";
import { QueryResults } from "@mcma/data";
import { AwsV4PresignedUrlGenerator } from "@mcma/aws-client";
import { MediaAsset, MediaAssetWorkflow, MediaEssence, MediaWorkflow } from "@local/model";

import { ConfigService } from "../config";
import { CognitoAuthService } from "../cognito-auth";
import { LoggerService } from "../logger";
import { DataOperation, DataUpdate } from "./data-update";

@Injectable({
  providedIn: "root"
})
export class DataService {
  private websocket$: Observable<any>;

  constructor(private http: HttpClient,
              private config: ConfigService,
              private auth: CognitoAuthService,
              private logger: LoggerService,
  ) {
    this.websocket$ = zip(
      this.config.get<string>("WebSocketUrl"),
      zip(
        this.config.get<string>("AwsRegion"),
        this.auth.getCredentialsProvider(),
      ).pipe(
        map(([ region, credentials ]) => new AwsV4PresignedUrlGenerator({ credentials, region })),
      )
    ).pipe(
      tap(() => this.logger.info("Connecting Websocket")),
      switchMap(([url, presignedUrlGenerator]) => presignedUrlGenerator.generatePresignedUrl("GET", url)),
      switchMap(url => webSocket(url)),
      retry(),
      map(obj => obj as DataUpdate<McmaResource>),
      filter(dataUpdate => dataUpdate.resource && (
          dataUpdate.operation === DataOperation.Insert ||
          dataUpdate.operation === DataOperation.Update ||
          dataUpdate.operation === DataOperation.Delete
        )
      ),
      tap(dataUpdate => this.logger.info(dataUpdate)),
      share(),
    );

    this.websocket$.subscribe(
      () => {},
      (error) => {
        this.logger.error("WebSocket Error:");
        this.logger.error(error);
      },
      () => {
        this.logger.warn("WebSocket Closed");
      });
  }

  private getRestApiUrl(): Observable<string> {
    return this.config.get<string>("RestApiUrl");
  }

  createWorkflow(workflow: MediaWorkflow): Observable<MediaWorkflow> {
    return this.getRestApiUrl().pipe(
      switchMap(url => this.http.post<MediaWorkflow>(`${url}/workflows`, workflow))
    );
  }

  listMediaWorkflows(pageSize: number, pageStartToken?: string): Observable<QueryResults<MediaWorkflow>> {
    const params: any = {
      sortBy: "dateCreated",
      sortOrder: "desc",
      pageSize,
    };
    if (pageStartToken) {
      params.pageStartToken = pageStartToken;
    }
    return this.getRestApiUrl().pipe(
      switchMap(url => this.http.get<QueryResults<MediaWorkflow>>(`${url}/workflows`, {
        params
      }))
    );
  }

  listMediaAssets(pageSize: number, pageStartToken?: string): Observable<QueryResults<MediaAsset>> {
    const params: any = {
      sortBy: "dateCreated",
      sortOrder: "desc",
      pageSize,
    };
    if (pageStartToken) {
      params.pageStartToken = pageStartToken;
    }
    return this.getRestApiUrl().pipe(
      switchMap(url => this.http.get<QueryResults<MediaAsset>>(`${url}/assets`, {
        params
      }))
    );
  }

  get<T>(url: string): Observable<T> {
    return this.http.get<T>(url);
  }

  getMediaAsset(guid: string): Observable<MediaAsset> {
    return this.getRestApiUrl().pipe(
      switchMap(url => this.http.get<MediaAsset>(`${url}/assets/${guid}`))
    );
  }

  deleteMediaAsset(assetId: string): Observable<void> {
    return this.http.delete<void>(assetId);
  }

  listMediaAssetEssences(guid: string): Observable<QueryResults<MediaEssence>> {
    const params: any = {
      sortBy: "dateCreated",
      sortOrder: "desc",
    };

    return this.getRestApiUrl().pipe(
      switchMap(url => this.http.get<QueryResults<MediaEssence>>(`${url}/assets/${guid}/essences`, {
        params
      }))
    );
  }

  listMediaAssetWorkflows(guid: string): Observable<QueryResults<MediaAssetWorkflow>> {
    const params: any = {
      sortBy: "dateCreated",
      sortOrder: "desc",
    };

    return this.getRestApiUrl().pipe(
      switchMap(url => this.http.get<QueryResults<MediaAssetWorkflow>>(`${url}/assets/${guid}/workflows`, {
        params
      }))
    );
  }

  getMediaWorkflowUpdates(): Observable<DataUpdate<MediaWorkflow>> {
    return this.websocket$.pipe(
      filter(obj => obj.resource["@type"] === "MediaWorkflow"),
    );
  }

  getMediaAssetUpdates(): Observable<DataUpdate<MediaAsset>> {
    return this.websocket$.pipe(
      filter(obj => obj.resource["@type"] === "MediaAsset"),
    );
  }

  getMediaEssenceUpdates(): Observable<DataUpdate<MediaEssence>> {
    return this.websocket$.pipe(
      filter(obj =>
        obj.resource["@type"] === "MediaEssence" ||
        obj.resource["@type"] === "VideoEssence" ||
        obj.resource["@type"] === "AudioEssence" ||
        obj.resource["@type"] === "ImageEssence"
      ),
    );
  }

  getMediaAssetWorkflowUpdates(): Observable<DataUpdate<MediaAssetWorkflow>> {
    return this.websocket$.pipe(
      filter(obj => obj.resource["@type"] === "MediaAssetWorkflow"),
    );
  }
}
