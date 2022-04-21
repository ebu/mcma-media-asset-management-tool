import { Component, OnInit } from "@angular/core";

import { MediaAssetWorkflow } from "@local/model";
import { MatSelectionListChange } from "@angular/material/list";
import { Subscription } from "rxjs";
import { map, switchMap } from "rxjs/operators";
import { ActivatedRoute } from "@angular/router";
import { DataService, LoggerService } from "../../services";

@Component({
  selector: "app-asset-workflows",
  templateUrl: "./asset-workflows.component.html",
  styleUrls: ["./asset-workflows.component.scss"]
})
export class AssetWorkflowsComponent implements OnInit {
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
    this.routeSubscription = this.route.params.pipe(
      map(params => params["guid"]),
      switchMap(guid => this.data.getMediaAssetWorkflows(guid))
    ).subscribe(essences => {
      this.logger.info(essences);
      this.mediaAssetWorkflows = essences.results;

      this.selectedMediaAssetWorkflow = this.mediaAssetWorkflows[0];
      this.isLoadingResults = false;
    });
  }

  onSelectionChange(event: MatSelectionListChange) {
    this.selectedMediaAssetWorkflow = event.options[0].value;
  }
}
