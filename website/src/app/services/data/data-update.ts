import { McmaResource } from "@mcma/core";

export enum DataOperation {
  Insert = "Insert",
  Update = "Update",
  Delete = "Delete",
  Ping = "Ping",
}

export interface DataUpdate<T extends McmaResource> {
  operation: DataOperation;
  resource: T;
}
