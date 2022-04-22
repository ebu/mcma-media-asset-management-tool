import { AfterViewInit, Component, OnDestroy, OnInit } from "@angular/core";
import { ActivatedRoute, Router } from "@angular/router";
import { Subscription } from "rxjs";
import { map, switchMap } from "rxjs/operators";
import { DataService } from "../../services";

import { MediaAsset } from "@local/model";
import { DataOperation } from "../../services/data/data-update";
import { MatDialog } from "@angular/material/dialog";
import { DialogAssetDeleteComponent } from "../../dialogs/dialog-asset-delete/dialog-asset-delete.component";

@Component({
  selector: "app-asset-view",
  templateUrl: "./asset-view.component.html",
  styleUrls: ["./asset-view.component.scss"]
})
export class AssetViewComponent implements OnInit, AfterViewInit, OnDestroy {

  asset: MediaAsset | undefined;

  private routeSubscription: Subscription | undefined;
  private dataUpdateSubscription: Subscription | undefined;

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private data: DataService,
    private dialog: MatDialog,
  ) { }

  ngOnInit(): void {
    this.routeSubscription = this.route.params.pipe(
      map(params => params["guid"]),
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
  }

  ngOnDestroy(): void {
    this.routeSubscription?.unsubscribe();
    this.dataUpdateSubscription?.unsubscribe();
  };

  openDialogAssetDelete() {
    if (this.asset) {
      DialogAssetDeleteComponent.createDialog(this.dialog, this.asset);
    }
  }

}
