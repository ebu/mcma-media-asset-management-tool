import { AfterViewChecked, AfterViewInit, Component, OnDestroy, ViewChild } from "@angular/core";
import { of, Subscription, zip } from "rxjs";
import { MatPaginator, PageEvent } from "@angular/material/paginator";
import { Router } from "@angular/router";
import { DataService, LoggerService } from "../../services";
import { DataOperation } from "../../services/data/data-update";
import { map, startWith, switchMap } from "rxjs/operators";
import { MediaWorkflow } from "@local/model";

const PageSize = 10;

@Component({
  selector: "app-workflows",
  templateUrl: "./workflows.component.html",
  styleUrls: ["./workflows.component.scss"]
})
export class WorkflowsComponent implements AfterViewInit, AfterViewChecked, OnDestroy {
  displayedColumns: string[] = ["asset", "workflow", "status", "created-date"];
  mediaWorkflows: MediaWorkflow[] = [];

  resultsLength = 0;
  nextPageTokens: string[] = [];
  isLoadingResults = true;

  paginatorSubscription: Subscription | undefined;
  dataUpdateSubscription: Subscription | undefined;

  @ViewChild(MatPaginator) paginator: MatPaginator | undefined;

  constructor(private router: Router,
              private data: DataService,
              private logger: LoggerService) {
  }

  ngAfterViewInit(): void {
    this.dataUpdateSubscription = this.data.getMediaWorkflowUpdates().subscribe(dataUpdate => {
      switch (dataUpdate.operation) {
        case DataOperation.Insert:
          if (this.paginator!.pageIndex === 0) {
            this.mediaWorkflows.unshift(dataUpdate.resource);
            if (this.mediaWorkflows.length > PageSize) {
              this.mediaWorkflows.pop();
            }
            this.mediaWorkflows = [...this.mediaWorkflows];
          }
          break;
        case DataOperation.Update:
          for (let i = 0; i < this.mediaWorkflows.length; i++) {
            if (this.mediaWorkflows[i].id === dataUpdate.resource.id) {
              this.mediaWorkflows[i] = dataUpdate.resource;
              this.mediaWorkflows = [...this.mediaWorkflows];
              break;
            }
          }
          break;
        case DataOperation.Delete:
          for (let i = this.mediaWorkflows.length - 1; i >= 0; i--) {
            if (this.mediaWorkflows[i].id === dataUpdate.resource.id) {
              this.mediaWorkflows.splice(i, 1);
              this.mediaWorkflows = [...this.mediaWorkflows];
              break;
            }
          }
          break;
      }
    });

    this.paginatorSubscription = this.paginator!.page.pipe(
      startWith({ pageIndex: 0, pageSize: PageSize, length: 0 }),
      switchMap((event: PageEvent) => {
        this.isLoadingResults = true;
        return zip(of(event), this.data.listMediaWorkflows(PageSize, this.nextPageTokens[event.pageIndex]));
      }),
      map(([event, queryResults]) => {
        this.isLoadingResults = false;

        if (queryResults.nextPageStartToken) {
          this.nextPageTokens[event.pageIndex + 1] = queryResults.nextPageStartToken;
        }

        this.resultsLength = this.nextPageTokens.length * PageSize;
        return queryResults.results;
      })
    ).subscribe(mediaWorkflows => this.mediaWorkflows = mediaWorkflows);
  }

  ngAfterViewChecked(): void {
    const list = document.getElementsByClassName("mat-paginator-range-label");
    list[0].innerHTML = "Page: " + (this.paginator!.pageIndex + 1);
  }

  ngOnDestroy(): void {
    this.dataUpdateSubscription?.unsubscribe();
    this.paginatorSubscription?.unsubscribe();
  }
}
