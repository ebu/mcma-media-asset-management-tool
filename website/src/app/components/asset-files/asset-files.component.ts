import { AfterViewInit, Component, OnDestroy, OnInit } from "@angular/core";
import { MatSelectionListChange } from "@angular/material/list";

import { S3Locator } from "@mcma/aws-s3";
import { ActivatedRoute } from "@angular/router";
import { Subscription } from "rxjs";
import { map, switchMap } from "rxjs/operators";

import { DataService, LoggerService } from "../../services";
import { MediaEssence, VideoEssence, ImageEssence, AudioEssence } from "@local/model";

@Component({
  selector: "app-asset-files",
  templateUrl: "./asset-files.component.html",
  styleUrls: ["./asset-files.component.scss"]
})
export class AssetFilesComponent implements OnInit, AfterViewInit, OnDestroy {
  mediaEssences: MediaEssence[] = [];
  selectedMediaEssence: MediaEssence | undefined;

  S3Locator = S3Locator;
  VideoEssence = VideoEssence;
  ImageEssence = ImageEssence;
  AudioEssence = AudioEssence;

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
      switchMap(guid => this.data.getMediaAssetEssences(guid))
    ).subscribe(essences => {
      this.logger.info(essences);
      this.mediaEssences = essences.results;

      this.selectedMediaEssence = this.mediaEssences[0];
      this.isLoadingResults = false;
    });
  }

  ngAfterViewInit(): void {
  }

  ngOnDestroy(): void {
    this.routeSubscription?.unsubscribe();
    this.dataUpdateSubscription?.unsubscribe();
  }

  buildEssenceName(mediaEssence: MediaEssence): string {
    let str = mediaEssence.filename;
    if (mediaEssence.tags?.length) {
      str += ` (${mediaEssence.tags.join(", ")})`
    }
    return str ?? "";
  }

  onEssenceSelectionChange(event: MatSelectionListChange){
    this.selectedMediaEssence = event.options[0].value;
  }

}
