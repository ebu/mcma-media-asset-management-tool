/* "Barrel" of Http Interceptors */
import { HTTP_INTERCEPTORS } from "@angular/common/http";

import { AwsV4Interceptor } from "./awsv4-interceptor";
import { JsonHttpInterceptor } from "./json-interceptor";
import { JsonParser } from "./json-parser";

/** Http interceptor providers in outside-in order */
export const httpInterceptorProviders = [
  { provide: HTTP_INTERCEPTORS, useClass: AwsV4Interceptor, multi: true },
  { provide: HTTP_INTERCEPTORS, useClass: JsonHttpInterceptor, multi: true },
  { provide: JsonParser, useClass: JsonParser }
];
