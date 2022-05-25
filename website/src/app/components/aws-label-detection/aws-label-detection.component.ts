import { Component, EventEmitter, Input, NgZone, OnChanges, OnDestroy, OnInit, Output, SimpleChanges } from "@angular/core";

import { MediaAssetWorkflow, MediaEssence } from "@local/model";
import { DataService, DrawHandler, LoggerService, VideoService } from "../../services";
import { from, Subscription } from "rxjs";
import { mergeMap, switchMap } from "rxjs/operators";
import { GetLabelDetectionResponse, LabelDetection } from "aws-sdk/clients/rekognition";
import { Rekognition } from "aws-sdk";
import { SelectionModel } from "@angular/cdk/collections";
import { binarySearch, ColorPalette, drawLabeledBox, getColor } from "../utils";

export interface LabelInfo {
  position: number,
  color: string,
  name: string,
  appearances: number[],
  confidence: string,
}

@Component({
  selector: "app-aws-label-detection",
  templateUrl: "./aws-label-detection.component.html",
  styleUrls: ["./aws-label-detection.component.scss"]
})
export class AwsLabelDetectionComponent implements OnInit, OnChanges, OnDestroy {

  @Input()
  assetWorkflow: MediaAssetWorkflow | undefined;

  @Output()
  isLoadingEvent = new EventEmitter<boolean>();

  labels: LabelInfo[] = [];
  selection = new SelectionModel<LabelInfo>(true, []);
  displayedColumns: string[] = ["select", "color", "name", "appearances", "confidence"];

  private labelData: Map<string, LabelDetection[]> = new Map<string, LabelDetection[]>();
  private labelNames: string[] = [];
  private selectionChangeSubscription: Subscription | undefined;
  private mediaEssenceSubscription: Subscription | undefined;
  private drawHandler: DrawHandler = this.draw.bind(this);

  constructor(
    private logger: LoggerService,
    private data: DataService,
    private videoService: VideoService,
    private ngZone: NgZone,
  ) { }

  ngOnInit(): void {
    this.selectionChangeSubscription = this.selection.changed.subscribe(() => this.videoService.invalidate());
    this.videoService.addDrawHandler(this.drawHandler);
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes["assetWorkflow"]) {
      const change = changes["assetWorkflow"];
      this.labelData.clear();
      this.labelNames = [];
      this.videoService.invalidate();
      const mediaEssenceIds = change.currentValue.data.mediaEssenceIds;
      if (Array.isArray(mediaEssenceIds) && mediaEssenceIds.length > 0) {
        this.setLoading(true);
        this.mediaEssenceSubscription = from(mediaEssenceIds).pipe(
          mergeMap(mediaEssenceId => this.data.get<MediaEssence>(mediaEssenceId).pipe(
            switchMap(me => this.data.get(me.locators[0].url)),
          )),
        ).subscribe(data => {
            const labelData = data as GetLabelDetectionResponse;
            if (labelData.Labels) {
              for (const label of labelData.Labels) {
                if (label.Timestamp && label.Label) {
                  const labelName = label.Label.Name;
                  const hasInstances = !!label.Label.Instances?.length;
                  if (labelName && hasInstances) {
                    let arr = this.labelData.get(labelName);
                    if (!arr) {
                      arr = [];
                      this.labelData.set(labelName, arr);
                    }
                    arr.push(label);
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
            this.labelNames = [...this.labelData.keys()].sort((a, b) => (this.labelData.get(b)?.length ?? 0) - (this.labelData.get(a)?.length ?? 0));
            for (let i = 0; i < this.labelNames.length; i++) {
              const labelName = this.labelNames[i];
              const labelData = this.labelData.get(labelName)!;
              labelData.sort((a, b) => a.Timestamp! - b.Timestamp!);

              const appearances: number[] = [];

              for (const celebrity of labelData) {
                const timestamp = Math.round(celebrity.Timestamp! / 1000);
                if (appearances.length === 0) {
                  appearances.push(timestamp);
                } else {
                  const prevTimestamp = appearances[appearances.length - 1];
                  if (prevTimestamp + 25 < timestamp) {
                    appearances.push(timestamp);
                  }
                }
              }

              const label = labelData[0];
              this.labels.push({
                position: i + 1,
                name: label.Label?.Name ?? "",
                confidence: "",
                color: getColor(i),
                appearances: appearances,
              });
            }

            this.labels = [...this.labels];
            this.selection.select(...this.labels);

            this.videoService.invalidate();
            this.setLoading(false);
          }
        );
      }
    }
  }

  ngOnDestroy(): void {
    this.mediaEssenceSubscription?.unsubscribe();
    this.selectionChangeSubscription?.unsubscribe();
    this.videoService.removeDrawHandler(this.drawHandler);
  }

  isAllSelected() {
    const numSelected = this.selection.selected.length;
    const numRows = this.labels.length;
    return numSelected === numRows;
  }

  /** Selects all rows if they are not all selected; otherwise clear selection. */
  masterToggle() {
    if (this.isAllSelected()) {
      this.selection.clear();
      return;
    }

    this.selection.select(...this.labels);
  }

  /** The label for the checkbox on the passed row */
  checkboxLabel(row?: LabelInfo): string {
    if (!row) {
      return `${this.isAllSelected() ? "deselect" : "select"} all`;
    }
    return `${this.selection.isSelected(row) ? "deselect" : "select"} row ${row.position}`;
  }

  private setLoading(value: boolean) {
    this.isLoadingEvent.emit(value);
  }

  private updateLabelStatistics(visibleLabels: Rekognition.Label[]) {
    const map = new Map<string, Rekognition.Label>();

    for (const label of visibleLabels) {
      map.set(label.Name!, label);
    }

    let changed = false;

    for (const label of this.labels) {
      let confidence = "";
      if (map.has(label.name)) {
        const data = map.get(label.name);
        if (!Number.isNaN(data!.Confidence)) {
          confidence = data!.Confidence?.toFixed(1) + "%";
        }
      }

      if (label.confidence !== confidence) {
        label.confidence = confidence;
        changed = true;
      }
    }

    if (changed) {
      this.ngZone.run(() => {
        this.labels = [...this.labels];
      });
    }
  }

  private draw(context: CanvasRenderingContext2D, width: number, height: number, currentTime: number) {
    const labels = this.findLabelsAtTime(Math.round(currentTime * 1000));

    this.updateLabelStatistics(labels);

    const visibleLabels = new Set<string>(this.selection.selected.map(l => l.name));

    labels.forEach(label => {
      const color = getColor(this.labelNames.indexOf(label.Name!));
      if (visibleLabels.has(label.Name!)) {
        for (const instance of label.Instances!) {
          drawLabeledBox(label.Name!, color, instance.BoundingBox!, context, width, height);
        }
      }
    });
  }

  private findLabelsAtTime(timestamp: number): Rekognition.Label[] {
    const labels: Rekognition.Label[] = [];

    for (const labelId of this.labelData.keys()) {
      const labelDataArr = this.labelData.get(labelId);

      const idx = binarySearch(labelDataArr!, (e => timestamp < e.Timestamp!)) - 1;

      const labelDetection = labelDataArr![idx];
      if (labelDetection && timestamp < labelDetection.Timestamp! + 200) {
        labels.push(labelDetection!.Label!);
      }
    }

    return labels;
  }

  seekVideo(timestamp: number) {
    this.videoService.seek(timestamp);
  }
}
