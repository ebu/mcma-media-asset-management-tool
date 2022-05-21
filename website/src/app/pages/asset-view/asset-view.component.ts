import { AfterViewInit, Component, ElementRef, OnDestroy, OnInit, ViewChild } from "@angular/core";
import { ActivatedRoute, Router } from "@angular/router";
import { Subscription } from "rxjs";
import { map, switchMap } from "rxjs/operators";
import { DataService, LoggerService, VideoService } from "../../services";

import { MediaAsset } from "@local/model";
import { DataOperation } from "../../services/data/data-update";
import { MatDialog } from "@angular/material/dialog";
import { DialogRunWorkflowComponent } from "../../dialogs/dialog-run-workflow/dialog-run-workflow.component";
import { DialogAssetDeleteComponent } from "../../dialogs/dialog-asset-delete/dialog-asset-delete.component";

@Component({
  selector: "app-asset-view",
  templateUrl: "./asset-view.component.html",
  styleUrls: ["./asset-view.component.scss"]
})
export class AssetViewComponent implements OnInit, AfterViewInit, OnDestroy {

  @ViewChild("container")
  public container: ElementRef | undefined;

  @ViewChild("video")
  public video: ElementRef | undefined;

  @ViewChild("canvas")
  public canvas: ElementRef | undefined;

  asset: MediaAsset | undefined;

  private assetGuid: string | undefined;

  private routeSubscription: Subscription | undefined;
  private dataUpdateSubscription: Subscription | undefined;

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private data: DataService,
    private dialog: MatDialog,
    private logger: LoggerService,
    private videoService: VideoService,
  ) { }

  ngOnInit(): void {
    this.routeSubscription = this.route.params.pipe(
      map(params => this.assetGuid = params["guid"]),
      switchMap(guid => this.data.getMediaAsset(guid))
    ).subscribe(asset => {
      this.asset = asset;
    });
  }

  ngAfterViewInit(): void {
    this.dataUpdateSubscription = this.data.getMediaAssetUpdates().subscribe(dataUpdate => {
      switch (dataUpdate.operation) {
        case DataOperation.Update:
          if (dataUpdate.resource.id === this.asset?.id) {
            this.asset = dataUpdate.resource;
          }
          break;
        case DataOperation.Delete:
          if (dataUpdate.resource.id === this.asset?.id) {
            this.router.navigate(["/assets"]);
          }
          break;
      }
    });

    document.addEventListener("fullscreenchange", (e: Event) => {
      if (!document.fullscreenElement) {
        this.videoService.resize(640, 360);
      }
    });

    if (this.container && this.video && this.canvas) {
      this.videoService.register(this.container.nativeElement, this.video.nativeElement, this.canvas.nativeElement);
      this.videoService.resize(640, 360);
    }
  }

  ngOnDestroy(): void {
    this.videoService.unregister();

    this.routeSubscription?.unsubscribe();
    this.dataUpdateSubscription?.unsubscribe();
  };

  openDialogRunWorkflow() {
    if (this.assetGuid && this.asset) {
      DialogRunWorkflowComponent.createDialog(this.dialog, this.assetGuid, this.asset);
    }
  }

  openDialogAssetDelete() {
    if (this.asset) {
      DialogAssetDeleteComponent.createDialog(this.dialog, this.asset);
    }
  }

}
