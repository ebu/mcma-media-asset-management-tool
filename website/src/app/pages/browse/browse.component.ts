import { AfterViewChecked, AfterViewInit, Component, OnDestroy, ViewChild } from "@angular/core";
import { Router } from "@angular/router";
import { MatPaginator, PageEvent } from "@angular/material/paginator";
import { of, Subscription, zip } from "rxjs";
import { map, startWith, switchMap } from "rxjs/operators";
import { MediaAssetProperties } from "@local/model";

import { DataService } from "../../services/data";
import { LoggerService } from "../../services";
import { DataOperation } from "../../services/data/data-update";


const PageSize = 10;

@Component({
  selector: "app-browse",
  templateUrl: "./browse.component.html",
  styleUrls: ["./browse.component.scss"]
})
export class BrowseComponent implements AfterViewInit, AfterViewChecked, OnDestroy {
  displayedColumns: string[] = ["thumbnail", "title", "description"];
  mediaAssets: MediaAssetProperties[] = [];

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
    this.dataUpdateSubscription = this.data.getMediaAssetUpdates().subscribe(dataUpdate => {
      switch (dataUpdate.operation) {
        case DataOperation.Insert:
          if (this.paginator!.pageIndex === 0) {
            this.mediaAssets.unshift(dataUpdate.resource);
            if (this.mediaAssets.length > PageSize) {
              this.mediaAssets.pop();
            }
            this.mediaAssets = [...this.mediaAssets];
          }
          break;
        case DataOperation.Update:
          for (let i = 0; i < this.mediaAssets.length; i++) {
            if (this.mediaAssets[i].id === dataUpdate.resource.id) {
              this.mediaAssets[i] = dataUpdate.resource;
              this.mediaAssets = [...this.mediaAssets];
              break;
            }
          }
          break;
        case DataOperation.Delete:
          for (let i = this.mediaAssets.length - 1; i >= 0; i--) {
            if (this.mediaAssets[i].id === dataUpdate.resource.id) {
              this.mediaAssets.splice(i, 1);
              this.mediaAssets = [...this.mediaAssets];
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
        return zip(of(event), this.data.listMediaAssets(PageSize, this.nextPageTokens[event.pageIndex]));
      }),
      map(([event, queryResults]) => {
        this.isLoadingResults = false;

        if (queryResults.nextPageStartToken) {
          this.nextPageTokens[event.pageIndex + 1] = queryResults.nextPageStartToken;
        }

        this.resultsLength = this.nextPageTokens.length * PageSize;
        return queryResults.results;
      })
    ).subscribe(mediaAssets => this.mediaAssets = mediaAssets);
  }

  ngAfterViewChecked(): void {
    const list = document.getElementsByClassName("mat-paginator-range-label");
    list[0].innerHTML = "Page: " + (this.paginator!.pageIndex + 1);
  }

  ngOnDestroy(): void {
    this.dataUpdateSubscription?.unsubscribe();
    this.paginatorSubscription?.unsubscribe();
  }

  openAsset(mediaAsset: MediaAssetProperties) {
    this.logger.info(mediaAsset);

    const assetGuid = mediaAsset.id!.substring(mediaAsset.id!.lastIndexOf("/") + 1);

    this.router.navigate([`assets/${assetGuid}`]);
  }
}

