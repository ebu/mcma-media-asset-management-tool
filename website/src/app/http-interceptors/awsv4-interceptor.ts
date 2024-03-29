import { Injectable, Injector } from "@angular/core";
import { HttpEvent, HttpHandler, HttpInterceptor, HttpRequest } from "@angular/common/http";
import { AxiosRequestHeaders, Method } from "axios";
import { Observable, zip } from "rxjs";
import { map, switchMap } from "rxjs/operators";
import { fromPromise } from "rxjs/internal-compatibility";
import { AwsV4Authenticator } from "@mcma/aws-client";
import { HttpRequestConfig } from "@mcma/client";
import { CognitoAuthService, ConfigService } from "../services";

@Injectable()
export class AwsV4Interceptor implements HttpInterceptor {

  constructor(private injector: Injector) {}

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    // handle relative urls without authentication (needed to fetch the config file to initialize the config service)
    if (!req.url.startsWith("http")) {
      return next.handle(req);
    }

    // only sign requests whose url matches the Rest API Url.
    return this.injector.get(ConfigService).get<string>("RestApiUrl").pipe(
      switchMap(url => req.url.startsWith(url) ? this.signRequest(req, next) : next.handle(req))
    );
  }

  private signRequest(request: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    return zip(
      this.injector.get(ConfigService).get<string>("AwsRegion"),
      this.injector.get(CognitoAuthService).getCredentialsProvider(),
    ).pipe(
      map(([region, credentials]) => new AwsV4Authenticator({ credentials, region })),
      switchMap(authenticator => {
        // converting Angular HTTP Request to Axios Request format so we can use the MCMA AWS4 Authenticator
        const headers: AxiosRequestHeaders = {};
        request.headers.keys().forEach(key => {
          const value = request.headers.get(key);
          if (value) {
            headers[key] = value;
          }
        });

        const params: { [key: string]: string } = {};
        request.params.keys().forEach(key => {
          const value = request.params.get(key);
          if (value) {
            params[key] = value;
          }
        });

        const axiosRequest: HttpRequestConfig = {
          method: request.method as Method,
          url: request.url,
          params,
          headers,
          data: request.serializeBody() ?? undefined,
        };

        // sign the axios request.
        return fromPromise(authenticator.sign(axiosRequest)).pipe(
          switchMap(() => {

            // copy the authorization headers from the axios request
            request = request.clone({
              setHeaders: {
                "Authorization": headers["Authorization"],
                "x-amz-date": headers["x-amz-date"],
                "x-amz-security-token": headers["x-amz-security-token"],
              }
            });

            return next.handle(request);
          })
        );
      })
    );
  }
}
