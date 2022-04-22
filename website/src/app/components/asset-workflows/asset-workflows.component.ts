import { Component, OnDestroy, OnInit } from "@angular/core";

import { MediaAssetWorkflow } from "@local/model";
import { MatSelectionListChange } from "@angular/material/list";
import { Subscription } from "rxjs";
import { map, switchMap } from "rxjs/operators";
import { ActivatedRoute } from "@angular/router";
import { DataService, LoggerService } from "../../services";
import { DataOperation } from "../../services/data/data-update";

@Component({
  selector: "app-asset-workflows",
  templateUrl: "./asset-workflows.component.html",
  styleUrls: ["./asset-workflows.component.scss"]
})
export class AssetWorkflowsComponent implements OnInit, OnDestroy {
  assetGuid: string | undefined;
  mediaAssetWorkflows: MediaAssetWorkflow[] = [];
  selectedMediaAssetWorkflow: MediaAssetWorkflow | undefined;

  isLoadingResults: boolean = true;

  private routeSubscription: Subscription | undefined;
  private dataUpdateSubscription: Subscription | undefined;

  constructor(
    private route: ActivatedRoute,
    private data: DataService,
    private logger: LoggerService,
  ) { }

  ngOnInit(): void {
    this.dataUpdateSubscription = this.data.getMediaAssetWorkflowUpdates().subscribe(dataUpdate => {
      const mediaAssetWorkflow = dataUpdate.resource;

      if (!this.assetGuid || !mediaAssetWorkflow?.id?.includes(this.assetGuid)) {
        return;
      }

      switch (dataUpdate.operation) {
        case DataOperation.Insert:
          this.mediaAssetWorkflows = [mediaAssetWorkflow, ...this.mediaAssetWorkflows];
          if (!this.selectedMediaAssetWorkflow) {
            this.selectedMediaAssetWorkflow = this.mediaAssetWorkflows[0];
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

    this.routeSubscription = this.route.params.pipe(
      map(params => this.assetGuid = params["guid"]),
      switchMap(guid => this.data.getMediaAssetWorkflows(guid))
    ).subscribe(essences => {
      this.logger.info(essences);
      this.mediaAssetWorkflows = essences.results;

      this.selectedMediaAssetWorkflow = this.mediaAssetWorkflows[0];
      this.isLoadingResults = false;
    });
  }

  ngOnDestroy(): void {
    this.routeSubscription?.unsubscribe();
    this.dataUpdateSubscription?.unsubscribe();
  }

  onSelectionChange(event: MatSelectionListChange) {
    this.selectedMediaAssetWorkflow = event.options[0].value;
  }
}
