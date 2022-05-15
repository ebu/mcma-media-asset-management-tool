import { Component, OnDestroy, OnInit } from "@angular/core";
import { MatSelectionListChange } from "@angular/material/list";

import { S3Locator } from "@mcma/aws-s3";
import { ActivatedRoute } from "@angular/router";
import { Subscription } from "rxjs";
import { map, switchMap } from "rxjs/operators";

import { DataService, LoggerService } from "../../services";
import { AudioEssence, ImageEssence, MediaEssence, VideoEssence } from "@local/model";
import { DataOperation } from "../../services/data/data-update";

@Component({
  selector: "app-asset-files",
  templateUrl: "./asset-files.component.html",
  styleUrls: ["./asset-files.component.scss"]
})
export class AssetFilesComponent implements OnInit, OnDestroy {
  assetGuid: string | undefined;
  mediaEssences: MediaEssence[] = [];
  selectedMediaEssence: MediaEssence | undefined;

  S3Locator = S3Locator;
  VideoEssence = VideoEssence;
  ImageEssence = ImageEssence;
  AudioEssence = AudioEssence;

  isLoading: boolean = true;

  private routeSubscription: Subscription | undefined;
  private dataUpdateSubscription: Subscription | undefined;

  constructor(
    private route: ActivatedRoute,
    private data: DataService,
    private logger: LoggerService,
  ) { }

  ngOnInit(): void {
    this.dataUpdateSubscription = this.data.getMediaEssenceUpdates().subscribe(dataUpdate => {
      const mediaEssence = dataUpdate.resource;

      if (!this.assetGuid || !mediaEssence?.id?.includes(this.assetGuid)) {
        return;
      }

      switch (dataUpdate.operation) {
        case DataOperation.Insert:
          if (!this.mediaEssences.find(e => e.id === dataUpdate.resource.id)) {
            this.mediaEssences = [mediaEssence, ...this.mediaEssences];
            if (!this.selectedMediaEssence) {
              this.selectedMediaEssence = this.mediaEssences[0];
            }
          }
          break;
        case DataOperation.Update:
          if (this.selectedMediaEssence?.id === mediaEssence.id) {
            this.selectedMediaEssence = mediaEssence;
          }
          for (let i = 0; i < this.mediaEssences.length; i++) {
            if (mediaEssence.id === this.mediaEssences[i].id) {
              this.mediaEssences[i] = mediaEssence;
              this.mediaEssences = [...this.mediaEssences];
              break;
            }
          }
          break;
        case DataOperation.Delete:
          for (let i = this.mediaEssences.length - 1; i >= 0; i--) {
            if (this.mediaEssences[i].id === dataUpdate.resource.id) {
              this.mediaEssences.splice(i, 1);
              this.mediaEssences = [...this.mediaEssences];
              break;
            }
          }
          break;
      }
    });

    this.routeSubscription = this.route.params.pipe(
      map(params => this.assetGuid = params["guid"]),
      switchMap(guid => this.data.listMediaAssetEssences(guid))
    ).subscribe(essences => {
      // this.logger.info(essences);
      this.mediaEssences = essences.results;

      this.selectedMediaEssence = this.mediaEssences[0];
      this.isLoading = false;
    });
  }

  ngOnDestroy(): void {
    this.routeSubscription?.unsubscribe();
    this.dataUpdateSubscription?.unsubscribe();
  }

  buildEssenceName(mediaEssence: MediaEssence): string {
    let str = mediaEssence.filename;
    if (mediaEssence.tags?.length) {
      str += ` (${mediaEssence.tags.join(", ")})`;
    }
    return str ?? "";
  }

  onEssenceSelectionChange(event: MatSelectionListChange) {
    this.selectedMediaEssence = event.options[0].value;
  }

}
