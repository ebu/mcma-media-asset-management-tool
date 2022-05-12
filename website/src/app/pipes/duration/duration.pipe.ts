import { Pipe, PipeTransform } from "@angular/core";

@Pipe({
  name: "duration",
  pure: true,
})
export class DurationPipe implements PipeTransform {

  transform(value: number | undefined, args?: any): string {
    let result = "";
    if (value !== undefined) {
      for (let i = 0; i < 3 && (value > 0 || i < 2); i++) {
        result = (value % 60).toString().padStart(2, "0") + result;
        value = Math.floor(value / 60);
        if (value > 0 || i < 1) {
          result = ":" + result;
        }
      }
    }
    return result;
  }
}
