import { Component, EventEmitter, Input, NgZone, OnChanges, OnDestroy, OnInit, Output, SimpleChanges, ViewChild } from "@angular/core";
import { FaceDetail, FaceDetection, GetFaceDetectionResponse } from "aws-sdk/clients/rekognition";
import { from, Subscription } from "rxjs";
import { DataService, DrawHandler, LoggerService, VideoService } from "../../services";
import { mergeMap, switchMap } from "rxjs/operators";
import { MediaAssetWorkflow, MediaEssence } from "@local/model";
import { ChartConfiguration, ChartData, ChartType } from "chart.js";
import { BaseChartDirective } from "ng2-charts";
import DatalabelsPlugin from "chartjs-plugin-datalabels";
import { binarySearch, drawLabeledBox, getColor } from "../utils";

@Component({
  selector: "app-aws-face-detection",
  templateUrl: "./aws-face-detection.component.html",
  styleUrls: ["./aws-face-detection.component.scss"]
})
export class AwsFaceDetectionComponent implements OnInit, OnChanges, OnDestroy {
  @ViewChild(BaseChartDirective) chart: BaseChartDirective | undefined;

  @Input()
  assetWorkflow: MediaAssetWorkflow | undefined;

  @Output()
  isLoadingEvent = new EventEmitter<boolean>();

  private faceData: FaceDetection[] = [];
  private mediaEssenceSubscription: Subscription | undefined;
  private drawHandler: DrawHandler = this.draw.bind(this);

  public pieChartOptions: ChartConfiguration["options"] = {
    responsive: true,
    plugins: {
      title: {
        display: true,
        fullSize: true,
        font: {
          size: 24
        },
        text: "Emotions",

      },
      legend: {
        display: true,
        position: "left",
      },
      datalabels: {
        formatter: (value, ctx) => {
          if (ctx.chart.data.labels) {
            if (value < 10) {
              return "";
            }
            return ctx.chart.data.labels[ctx.dataIndex];
          }
        },
      },
    }
  };
  public pieChartData: ChartData<"pie", number[], string> = {
    labels: ["ANGRY", "CALM", "CONFUSED", "DISGUSTED", "FEAR", "HAPPY", "SAD", "SURPRISED"],
    datasets: [{
      data: [12.5, 12.5, 12.5, 12.5, 12.5, 12.5, 12.5, 12.5]
    }]
  };
  public pieChartType: ChartType = "pie";
  public pieChartPlugins = [DatalabelsPlugin];

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
      this.faceData = [];
      this.videoService.invalidate();
      const mediaEssenceIds = change.currentValue.data.mediaEssenceIds;
      if (Array.isArray(mediaEssenceIds) && mediaEssenceIds.length > 0) {
        this.setLoading(true);
        this.mediaEssenceSubscription = from(mediaEssenceIds).pipe(
          mergeMap(mediaEssenceId => this.data.get<MediaEssence>(mediaEssenceId).pipe(
            switchMap(me => this.data.get(me.locators[0].url)),
          )),
        ).subscribe(data => {
            const faceData = data as GetFaceDetectionResponse;
            if (faceData.Faces) {
              for (const face of faceData.Faces) {
                if (face.Timestamp && face.Face) {
                  this.faceData.push(face);
                }
              }
            }
          },
          error => {
            this.logger.warn(error);
            this.setLoading(false);
          },
          () => {
            this.faceData.sort((a, b) => a.Timestamp! - b.Timestamp!);

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

  private setLoading(value: boolean) {
    this.isLoadingEvent.emit(value);
  }

  private updateFaceStatistics(visibleFaces: FaceDetail[]) {
    const emotions = new Map<string, number>();

    for (const face of visibleFaces) {
      if (face.Emotions) {
        for (const emotion of face.Emotions) {
          if (emotion.Type && emotion.Confidence) {
            let confidence = emotions.get(emotion.Type) ?? 0;
            emotions.set(emotion.Type, confidence + emotion.Confidence);
          }
        }
      }
    }

    const total = [...emotions.values()].reduce((partialSum, a) => partialSum + a, 0);
    if (total > 0) {
      for (const key of emotions.keys()) {
        emotions.set(key, (emotions.get(key) ?? 0) / total * 100);
      }

      let data: number[] = [];
      if (this.pieChartData.labels) {
        for (const label of this.pieChartData.labels) {
          data.push(emotions.get(label)!);
        }
      }

      this.pieChartData.datasets[0].data = data;
      this.ngZone.run(() => {
        this.chart?.update();
      });
    }
  }

  private draw(context: CanvasRenderingContext2D, width: number, height: number, currentTime: number) {
    const faces = this.findFacesAtTime(Math.round(currentTime * 1000));

    this.updateFaceStatistics(faces);

    for (let i = 0; i < faces.length; i++) {
      const face = faces[i];
      const text = face.Gender!.Value! + " aged " + face.AgeRange?.Low + "-" + face.AgeRange?.High;
      drawLabeledBox(text, getColor(2), faces[i].BoundingBox!, context, width, height);
    }
  }


  private findFacesAtTime(timestamp: number): FaceDetail[] {
    const faces: FaceDetail[] = [];

    const idx = binarySearch(this.faceData, (e => timestamp < e.Timestamp!)) - 1;

    let faceDetection = this.faceData[idx];
    if (faceDetection && timestamp < faceDetection.Timestamp! + 500) {
      const timestamp = faceDetection.Timestamp!;

      for (let i = idx; i >= 0; i--) {
        faceDetection = this.faceData[i];
        if (!faceDetection || faceDetection.Timestamp! !== timestamp) {
          break;
        }
        faces.push(faceDetection!.Face!);
      }
    }

    return faces;
  }

  public setVisible(visible: boolean) {
    if (visible) {
      this.chart?.render();
    }
  }
}
