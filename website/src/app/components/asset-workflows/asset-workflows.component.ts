import { Component, OnDestroy, OnInit, ViewChild } from "@angular/core";
import { MatSelectionListChange } from "@angular/material/list";
import { ActivatedRoute } from "@angular/router";
import { Subscription } from "rxjs";
import { filter, map, switchMap } from "rxjs/operators";

import { MediaAssetWorkflow, MediaWorkflow } from "@local/model";

import { DataService, LoggerService } from "../../services";
import { DataOperation } from "../../services/data/data-update";
import { JobStatus } from "@mcma/core";
import { AwsFaceDetectionComponent } from "../aws-face-detection/aws-face-detection.component";

@Component({
  selector: "app-asset-workflows",
  templateUrl: "./asset-workflows.component.html",
  styleUrls: ["./asset-workflows.component.scss"]
})
export class AssetWorkflowsComponent implements OnInit, OnDestroy {
  @ViewChild(AwsFaceDetectionComponent) awsFacesDetection: AwsFaceDetectionComponent | undefined;

  assetGuid: string | undefined;
  mediaAssetWorkflows: MediaAssetWorkflow[] = [];
  selectedMediaAssetWorkflow: MediaAssetWorkflow | undefined;
  mediaWorkflow: MediaWorkflow | undefined;

  private isParentLoading: boolean = true;
  private isChildLoading: boolean = false;

  get isLoading(): boolean {
    return this.isParentLoading || this.isChildLoading;
  }

  private routeSubscription: Subscription | undefined;
  private mediaAssetWorkflowUpdateSubscription: Subscription | undefined;
  private mediaWorkflowSubscription: Subscription | undefined;
  private mediaWorkflowUpdateSubscription: Subscription | undefined;

  get mediaWorkflowDuration(): number | undefined {
    if (this.mediaWorkflow) {
      switch (this.mediaWorkflow.status) {
        case JobStatus.Completed:
        case JobStatus.Failed:
        case JobStatus.Canceled:
          const dateCreated = this.mediaWorkflow.dateCreated;
          const dateModified = this.mediaWorkflow.dateModified;
          if (dateCreated && dateModified) {
            return Math.round((dateModified.getTime() - dateCreated.getTime()) / 1000);
          }
      }
    }
    return undefined;
  }

  constructor(
    private route: ActivatedRoute,
    private data: DataService,
    private logger: LoggerService,
  ) { }

  ngOnInit(): void {
    this.mediaAssetWorkflowUpdateSubscription = this.data.getMediaAssetWorkflowUpdates().subscribe(dataUpdate => {
      const mediaAssetWorkflow = dataUpdate.resource;

      if (!this.assetGuid || !mediaAssetWorkflow?.id?.includes(this.assetGuid)) {
        return;
      }

      switch (dataUpdate.operation) {
        case DataOperation.Insert:
          if (!this.mediaAssetWorkflows.find(wf => wf.id === dataUpdate.resource.id)) {
            this.mediaAssetWorkflows = [mediaAssetWorkflow, ...this.mediaAssetWorkflows];
            if (!this.selectedMediaAssetWorkflow) {
              this.selectedMediaAssetWorkflow = this.mediaAssetWorkflows[0];
            }
          }
          break;
        case DataOperation.Update:
          if (this.selectedMediaAssetWorkflow?.id === mediaAssetWorkflow.id) {
            this.selectedMediaAssetWorkflow = mediaAssetWorkflow;
          }
          for (let i = 0; i < this.mediaAssetWorkflows.length; i++) {
            if (mediaAssetWorkflow.id === this.mediaAssetWorkflows[i].id) {
              this.mediaAssetWorkflows[i] = mediaAssetWorkflow;
              this.mediaAssetWorkflows = [...this.mediaAssetWorkflows];
              break;
            }
          }
          break;
        case DataOperation.Delete:
          for (let i = this.mediaAssetWorkflows.length - 1; i >= 0; i--) {
            if (this.mediaAssetWorkflows[i].id === dataUpdate.resource.id) {
              this.mediaAssetWorkflows.splice(i, 1);
              this.mediaAssetWorkflows = [...this.mediaAssetWorkflows];
              break;
            }
          }
          break;
      }
    });

    this.mediaWorkflowUpdateSubscription = this.data.getMediaWorkflowUpdates().pipe(
      filter(dataUpdate => dataUpdate.operation === DataOperation.Update),
      map(dataUpdate => dataUpdate.resource),
      filter(mediaWorkflow => mediaWorkflow.mediaAssetWorkflowId === this.selectedMediaAssetWorkflow?.id),
    ).subscribe(mediaWorkflow => {
      this.mediaWorkflow = mediaWorkflow;
    });

    this.routeSubscription = this.route.params.pipe(
      map(params => this.assetGuid = params["guid"]),
      switchMap(guid => this.data.listMediaAssetWorkflows(guid))
    ).subscribe(assetWorkflows => {
      this.mediaAssetWorkflows = assetWorkflows.results;

      this.selectedMediaAssetWorkflow = this.mediaAssetWorkflows[0];
      this.updateWorkflow();
    });
  }

  ngOnDestroy(): void {
    this.routeSubscription?.unsubscribe();
    this.mediaAssetWorkflowUpdateSubscription?.unsubscribe();
    this.mediaWorkflowUpdateSubscription?.unsubscribe();
    this.mediaWorkflowSubscription?.unsubscribe();
  }

  onSelectionChange(event: MatSelectionListChange) {
    this.selectedMediaAssetWorkflow = event.options[0].value;
    this.updateWorkflow();
  }

  private updateWorkflow() {
    this.mediaWorkflow = undefined;
    this.mediaWorkflowSubscription?.unsubscribe();

    if (this.selectedMediaAssetWorkflow) {
      this.isParentLoading = true;
      this.isChildLoading = false;
      this.mediaWorkflowSubscription = this.data.get<MediaWorkflow>(this.selectedMediaAssetWorkflow.mediaWorkflowId).subscribe(wf => {
        this.mediaWorkflow = wf;
        this.isParentLoading = false;
      });
    } else {
      this.isParentLoading = false;
    }
  }

  setChildLoading(isLoading: boolean) {
    this.isChildLoading = isLoading;
  }

  setVisible(visible: boolean) {
    this.awsFacesDetection?.setVisible(visible);
  }
}
