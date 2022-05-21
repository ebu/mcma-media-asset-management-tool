import { Injectable, NgZone } from "@angular/core";
import { interval, Subscription } from "rxjs";
import { McmaException } from "@mcma/core";

export type DrawHandler = (context: CanvasRenderingContext2D, width: number, height: number, currentTime: number) => void;

@Injectable({
  providedIn: "root"
})
export class VideoService {

  private container?: HTMLDivElement;
  private video?: HTMLVideoElement;
  private canvas?: HTMLCanvasElement;

  private redrawSubscription?: Subscription;
  private drawHandlers: DrawHandler[] = [];

  constructor(private ngZone: NgZone) { }

  register(container: HTMLDivElement, video: HTMLVideoElement, canvas: HTMLCanvasElement) {
    this.container = container;
    this.video = video;
    this.canvas = canvas;

    if (this.video) {
      this.video.onplay = this.onPlay.bind(this);
      this.video.onpause = this.onPause.bind(this);
      this.video.onseeked = this.invalidate.bind(this);
      this.video.onresize = this.invalidate.bind(this);
      this.video.ondblclick = this.toggleFullScreen.bind(this);
    }
  }

  unregister() {
    if (this.video) {
      this.video.onplay = null;
      this.video.onpause = null;
      this.video.onseeked = null;
      this.video.onresize = null;
    }

    this.video = undefined;
    this.canvas = undefined;
  }

  private onPlay(ev: Event) {
    this.ngZone.runOutsideAngular(() => {
      this.redrawSubscription = interval(100).subscribe(() => this.invalidate());
    });
  }

  private onPause(ev: Event) {
    this.redrawSubscription?.unsubscribe();
  }

  resize(width: number, height: number) {
    if (this.video) {
      this.video.width = width;
      this.video.height = height;
    }
    if (this.canvas) {
      this.canvas.width = width;
      this.canvas.height = height;
    }
  }

  invalidate() {

    if (this.canvas && this.video) {
      const context = this.canvas.getContext("2d");

      if (context !== null) {
        const canvasWidth = this.canvas.width;
        const canvasHeight = this.canvas.height;
        const videoWidth = this.video.videoWidth;
        const videoHeight = this.video.videoHeight;
        const currentTime = this.video.currentTime;

        context.setTransform(1, 0, 0, 1, 0, 0);
        context.clearRect(0, 0, canvasWidth, canvasHeight);

        let offsetLeft, offsetTop, offsetWidth, offsetHeight;
        if (videoWidth / videoHeight > canvasWidth / canvasHeight) { // letter boxing
          offsetLeft = 0;
          offsetWidth = canvasWidth;
          offsetHeight = Math.round(offsetWidth * videoHeight / videoWidth);
          offsetTop = Math.floor((canvasHeight - offsetHeight) / 2);
        } else { // pillar boxing
          offsetTop = 0;
          offsetHeight = canvasHeight;
          offsetWidth = Math.round(offsetHeight * videoWidth / videoHeight);
          offsetLeft = Math.floor((canvasWidth - offsetWidth) / 2);
        }

        context.translate(offsetLeft, offsetTop);
        for (const drawHandler of this.drawHandlers) {
          drawHandler(context, offsetWidth, offsetHeight, currentTime);
        }
      }
    }
  }

  addDrawHandler(drawHandler: DrawHandler) {
    const idx = this.drawHandlers.indexOf(drawHandler);
    if (idx >= 0) {
      throw new McmaException("addDrawHandler: DrawHandler already added");
    }
    this.drawHandlers.push(drawHandler);
    this.invalidate();
  }

  removeDrawHandler(drawHandler: DrawHandler) {
    const idx = this.drawHandlers.indexOf(drawHandler);
    if (idx < 0) {
      throw new McmaException("removeDrawHandler: DrawHandler not found");
    }
    this.drawHandlers.splice(idx, 1);
    this.invalidate();
  }

  toggleFullScreen() {
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      let width = screen.width;
      let height = screen.height;

      if (this.container && this.video) {
        this.container.requestFullscreen().then(() => {
          if (this.container) {
            this.resize(width, height);
          }
        });
      }
    }
  }

  seek(timestamp: number) {
    if (this.video) {
      this.video.currentTime = timestamp;
    }
  }
}
