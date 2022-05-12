import { Utils } from "@mcma/core";

export class JsonParser {
  parse(text: string): any {
    return JSON.parse(text, Utils.reviver);
  }
}
