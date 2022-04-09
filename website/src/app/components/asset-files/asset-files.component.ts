import { AfterViewInit, Component, OnDestroy, OnInit } from "@angular/core";
import { ActivatedRoute } from "@angular/router";
import { DataService, LoggerService } from "../../services";
import { Subscription } from "rxjs";
import { map, switchMap } from "rxjs/operators";

@Component({
  selector: 'app-asset-files',
  templateUrl: './asset-files.component.html',
  styleUrls: ['./asset-files.component.scss']
})
export class AssetFilesComponent implements OnInit, AfterViewInit, OnDestroy {

  private routeSubscription: Subscription | undefined;
  private dataUpdateSubscription: Subscription | undefined;

  constructor(
    private route: ActivatedRoute,
    private data: DataService,
    private logger: LoggerService,
  ) { }

  ngOnInit(): void {
    this.routeSubscription = this.route.params.pipe(
      map(params => params["guid"]),
      switchMap(guid => this.data.getMediaAssetEssences(guid))
    ).subscribe(essences => {
      this.logger.info(essences);
    });
  }

  ngAfterViewInit(): void {
  }

  ngOnDestroy(): void {
    this.routeSubscription?.unsubscribe();
    this.dataUpdateSubscription?.unsubscribe();
  }

}
