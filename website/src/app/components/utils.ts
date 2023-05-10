import { BoundingBox } from "@aws-sdk/client-rekognition";

export const ColorPalette = ["#ec3445", "#fcdd30", "#51bc37", "#1582fd", "#733294", "#fb761f", "#ab526b", "#cdb380", "#005f6b", "#f02475", "#aab3ab", "#607848", "#ff4e50", "#40c0cb", "#e1edb9", "#d3ce3d", "#5e8c6a", "#f0a830", "#2a2829", "#ff8c94", "#5d4157", "#6a4a3c", "#bef202", "#f9f2e7"];

export function getColor(idx: number): string {
  return ColorPalette[idx % ColorPalette.length];
}

export function drawLabeledBox(text: string, color: string, boundingBox: BoundingBox, context: CanvasRenderingContext2D, screenWidth: number, screenHeight: number) {
  const x = (boundingBox?.Left ?? -1) * screenWidth;
  const y = (boundingBox?.Top ?? -1) * screenHeight;
  const w = (boundingBox?.Width ?? -1) * screenWidth;
  const h = (boundingBox?.Height ?? -1) * screenHeight;

  if (x >= 0 && y >= 0 && w >= 0 && h >= 0) {

    const font = "Verdana";

    context.beginPath();
    context.fillStyle = color;
    context.strokeStyle = color;
    context.lineWidth = 3;
    context.rect(x, y, w, h);
    context.stroke();

    const fontHeight = 20;
    const hMargin = 4;
    context.font = fontHeight + "px " + font;
    context.textAlign = "left";
    context.textBaseline = "top";
    const txtWidth = context.measureText(text).width + 2 * hMargin;
    const txtLeft = x + w / 2 - txtWidth / 2 + hMargin;
    const boxWidth = w > txtWidth ? w : txtWidth;
    const boxHeight = fontHeight + 2;
    const boxTop = (y - boxHeight - 1) < 0 ? 0 : (y - boxHeight);
    const boxLeft = x + w / 2 - boxWidth / 2;
    const txtTop = boxTop + 2;

    context.fillRect(boxLeft, boxTop, boxWidth, boxHeight);
    context.strokeRect(boxLeft, boxTop, boxWidth, boxHeight);
    context.fillStyle = "black";
    context.fillText(text, txtLeft, txtTop);
  }
}

export function binarySearch<T>(array: Array<T>, pred: (e: T) => boolean): number {
  let lo = -1, hi = array.length;
  while (1 + lo < hi) {
    const mi = lo + ((hi - lo) >> 1);
    if (pred(array[mi])) {
      hi = mi;
    } else {
      lo = mi;
    }
  }
  return hi;
}
