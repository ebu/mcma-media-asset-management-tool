import { Component, EventEmitter, Input, NgZone, OnChanges, OnDestroy, OnInit, Output, SimpleChanges } from "@angular/core";

import { MediaAssetWorkflow, MediaEssence } from "@local/model";
import { DataService, DrawHandler, LoggerService, VideoService } from "../../services";
import { mergeMap, switchMap } from "rxjs/operators";
import { from, Subscription } from "rxjs";
import { CelebrityDetail, CelebrityRecognition, GetCelebrityRecognitionResponse } from "@aws-sdk/client-rekognition";
import { binarySearch, drawLabeledBox, getColor } from "../utils";

export interface CelebrityInfo {
  id: string,
  color: string,
  name: string,
  url: string,
  appearances: number[],
  confidence: string,
}

@Component({
  selector: "app-aws-celebrity-recognition",
  templateUrl: "./aws-celebrity-recognition.component.html",
  styleUrls: ["./aws-celebrity-recognition.component.scss"]
})
export class AwsCelebrityRecognitionComponent implements OnInit, OnChanges, OnDestroy {

  @Input()
  assetWorkflow: MediaAssetWorkflow | undefined;

  @Output()
  isLoadingEvent = new EventEmitter<boolean>();

  celebrities: CelebrityInfo[] = [];
  displayedColumns: string[] = ["color", "name", "appearances", "confidence"];

  private celebrityData: Map<string, CelebrityRecognition[]> = new Map<string, CelebrityRecognition[]>();
  private mediaEssenceSubscription: Subscription | undefined;
  private drawHandler: DrawHandler = this.draw.bind(this);

  constructor(
    private logger: LoggerService,
    private data: DataService,
    private videoService: VideoService,
    private ngZone: NgZone,
  ) { }

  ngOnInit(): void {
    this.videoService.addDrawHandler(this.drawHandler);
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes["assetWorkflow"]) {
      const change = changes["assetWorkflow"];
      this.celebrityData.clear();
      this.celebrities = [];
      this.videoService.invalidate();
      const mediaEssenceIds = change.currentValue.data.mediaEssenceIds;
      if (Array.isArray(mediaEssenceIds) && mediaEssenceIds.length > 0) {
        this.setLoading(true);
        this.mediaEssenceSubscription = from(mediaEssenceIds).pipe(
          mergeMap(mediaEssenceId => this.data.get<MediaEssence>(mediaEssenceId).pipe(
            switchMap(me => this.data.get(me.locators[0].url)),
          )),
        ).subscribe(data => {
            const celebrityData = data as GetCelebrityRecognitionResponse;
            if (celebrityData?.Celebrities) {
              for (const celebrity of celebrityData.Celebrities) {
                if (celebrity.Timestamp && celebrity.Celebrity) {
                  const celebrityId = celebrity.Celebrity.Id;
                  if (celebrityId) {
                    let arr = this.celebrityData.get(celebrityId);
                    if (!arr) {
                      arr = [];
                      this.celebrityData.set(celebrityId, arr);
                    }
                    arr.push(celebrity);
                  }
                }
              }
            }
          },
          error => {
            this.logger.warn(error);
            this.setLoading(false);
          },
          () => {
            const celebrityIds = [...this.celebrityData.keys()];
            for (let i = 0; i < celebrityIds.length; i++) {
              const celebrityId = celebrityIds[i];
              const celebrityData = this.celebrityData.get(celebrityId)!;
              celebrityData.sort((a, b) => a.Timestamp! - b.Timestamp!);

              const appearances: number[] = [];

              for (const celebrity of celebrityData) {
                const timestamp = celebrity.Timestamp! / 1000;
                if (appearances.length === 0) {
                  appearances.push(timestamp);
                } else {
                  const prevTimestamp = appearances[appearances.length - 1];
                  if (prevTimestamp + 25 < timestamp) {
                    appearances.push(timestamp);
                  }
                }
              }

              const celebrity = celebrityData[0];
              this.celebrities.push({
                id: celebrityId,
                name: celebrity.Celebrity?.Name ?? "",
                color: getColor(i),
                url: celebrity.Celebrity?.Urls?.[0] ?? "",
                appearances: appearances,
                confidence: "",
              });
            }

            this.celebrities = [...this.celebrities];

            this.videoService.invalidate();
            this.setLoading(false);
          }
        );
      }
    }
  }

  ngOnDestroy(): void {
    this.mediaEssenceSubscription?.unsubscribe();
    this.videoService.removeDrawHandler(this.drawHandler);
  }

  setLoading(value: boolean) {
    this.isLoadingEvent.emit(value);
  }

  private updateCelebrityStatistics(visibleCelebrities: CelebrityDetail[]) {
    const map = new Map<string, CelebrityDetail>();

    for (const celebrity of visibleCelebrities) {
      map.set(celebrity.Id!, celebrity);
    }

    let changed = false;

    for (const celebrity of this.celebrities) {
      let confidence = "";
      if (map.has(celebrity.id)) {
        const data = map.get(celebrity.id);
        if (!Number.isNaN(data!.Confidence)) {
          confidence = data!.Confidence?.toFixed(1) + "%";
        }
      }

      if (celebrity.confidence !== confidence) {
        celebrity.confidence = confidence;
        changed = true;
      }
    }

    if (changed) {
      this.ngZone.run(() => {
        this.celebrities = [...this.celebrities];
      });
    }
  }

  private draw(context: CanvasRenderingContext2D, width: number, height: number, currentTime: number) {
    const celebrityDetails = this.findCelebritiesAtTime(Math.round(currentTime * 1000));

    this.updateCelebrityStatistics(celebrityDetails);

    const celebrityIds = [...this.celebrityData.keys()];

    for (const celebrityDetail of celebrityDetails) {
      const color = getColor(celebrityIds.indexOf(celebrityDetail.Id!));
      drawLabeledBox(celebrityDetail.Name!, color, celebrityDetail.Face!.BoundingBox!, context, width, height);
    }
  }

  private findCelebritiesAtTime(timestamp: number): CelebrityDetail[] {
    const celebrityDetails: CelebrityDetail[] = [];

    for (const celebrityId of this.celebrityData.keys()) {
      const celebrityDataArr = this.celebrityData.get(celebrityId);

      const idx = binarySearch(celebrityDataArr!, (e => timestamp < e.Timestamp!)) - 1;

      const celebrityRecognition = celebrityDataArr![idx];
      if (celebrityRecognition && timestamp < celebrityRecognition.Timestamp! + 600) {
        celebrityDetails.push(celebrityRecognition!.Celebrity!);
      }
    }

    return celebrityDetails;
  }

  seekVideo(timestamp: number) {
    this.videoService.seek(timestamp);
  }
}
