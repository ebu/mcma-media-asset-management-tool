import {
  HttpEvent,
  HttpHandler,
  HttpInterceptor,
  HttpRequest,
  HttpResponse
} from "@angular/common/http";
import { Injectable, Optional } from "@angular/core";
import { Observable } from "rxjs";
import { map } from "rxjs/operators";
import { JsonParser } from "./json-parser";

@Injectable()
export class JsonHttpInterceptor implements HttpInterceptor {
  constructor(@Optional() private jsonParser: JsonParser) {}

  intercept(
    httpRequest: HttpRequest<any>,
    next: HttpHandler
  ): Observable<HttpEvent<any>> {
    return httpRequest.responseType === "json"
      ? this.handleJsonResponses(httpRequest, next)
      : next.handle(httpRequest);
  }

  private handleJsonResponses(
    httpRequest: HttpRequest<any>,
    next: HttpHandler
  ): Observable<HttpEvent<any>> {
    return next
      .handle(httpRequest.clone({ responseType: "text" }))
      .pipe(map(event => this.parseResponse(event)));
  }

  private parseResponse(event: HttpEvent<any>): HttpEvent<any> {
    return event instanceof HttpResponse && event.body
      ? event.clone({ body: this.jsonParser.parse(event.body) })
      : event;
  }
}
