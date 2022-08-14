import { Component, EventEmitter, Input, NgZone, OnChanges, OnDestroy, OnInit, Output, SimpleChanges } from "@angular/core";
import { from, Subscription } from "rxjs";
import { filter, map, mergeMap, switchMap, take } from "rxjs/operators";

import { DataService, LoggerService, VideoService } from "../../services";

import { MediaAssetWorkflow, MediaEssence } from "@local/model";
import { HttpClient } from "@angular/common/http";

export interface CaptionInfo {
  timestamp: number;
  lines: string[];
}

@Component({
  selector: "app-google-transcription",
  templateUrl: "./google-transcription.component.html",
  styleUrls: ["./google-transcription.component.scss"]
})
export class GoogleTranscriptionComponent implements OnInit, OnChanges, OnDestroy {

  @Input()
  assetWorkflow: MediaAssetWorkflow | undefined;

  @Output()
  isLoadingEvent = new EventEmitter<boolean>();

  captions: CaptionInfo[] = [];
  displayedColumns: string[] = ["timestamp", "text"];

  private mediaEssenceSubscription: Subscription | undefined;

  constructor(private http: HttpClient,
              private logger: LoggerService,
              private data: DataService,
              private videoService: VideoService,
  ) { }

  ngOnInit(): void {
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes.assetWorkflow) {
      const change = changes.assetWorkflow;
      const mediaEssenceIds = change.currentValue.data.mediaEssenceIds;
      this.ngOnDestroy();
      this.captions = [];
      if (Array.isArray(mediaEssenceIds) && mediaEssenceIds.length > 0) {
        this.setLoading(true);
        this.mediaEssenceSubscription = from(mediaEssenceIds).pipe(
          mergeMap(mediaEssenceId => this.data.get<MediaEssence>(mediaEssenceId)),
          filter(me => me.extension === "vtt"),
          take(1),
          map(me => me.locators[0].url),
          switchMap(url => this.http.get(url, { responseType: "text" })),
        ).subscribe((data) => {
            this.videoService.addCaptionsTrack("English", "en", data);

            const lines = data.split("\n");

            let start;
            for (let i = 0; i < lines.length; i++) {
              if (lines[i] === "") {
                this.processCaptionLines(lines, start, i);
                start = i;
              }
            }
            this.processCaptionLines(lines, start, lines.length);
          },
          error => {
            this.logger.warn(error);
            this.setLoading(false);
          },
          () => {

            this.captions = [...this.captions];

            this.setLoading(false);
          });
      }
    }
  }

  private processCaptionLines(lines: string[], start: number | undefined, end: number): void {
    if (start) {
      const timestampLine = lines[start + 2];
      const textLines = lines.slice(start + 3, end);
      const timestampStr = timestampLine.substring(0, timestampLine.indexOf(" "));
      const parts = timestampStr.split(":");

      const timestamp = Number.parseInt(parts[0], 10) * 3600 + Number.parseInt(parts[1], 10) * 60 + Number.parseFloat(parts[2]);
      this.captions.push({ timestamp, lines: textLines });
    }
  }

  ngOnDestroy(): void {
    this.mediaEssenceSubscription?.unsubscribe();
    this.videoService.removeCaptionsTrack();
  }

  setLoading(value: boolean): void {
    this.isLoadingEvent.emit(value);
  }

  seekVideo(timestamp: number): void {
    this.videoService.seek(timestamp);
  }
}
