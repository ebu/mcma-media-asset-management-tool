import { Component, Inject, OnDestroy, OnInit } from "@angular/core";
import { MAT_DIALOG_DATA, MatDialog, MatDialogRef } from "@angular/material/dialog";

import { MediaAsset, MediaEssence, MediaWorkflow, MediaWorkflowType } from "@local/model";

import { DataService, LoggerService } from "../../services";
import { Subscription } from "rxjs";
import { Router } from "@angular/router";


@Component({
  selector: "app-dialog-run-workflow",
  templateUrl: "./dialog-run-workflow.component.html",
  styleUrls: ["./dialog-run-workflow.component.scss"]
})
export class DialogRunWorkflowComponent implements OnInit, OnDestroy {

  workflowTypes = Object.keys(MediaWorkflowType).filter(wft => wft !== MediaWorkflowType.MediaIngest);
  selectedWorkflowType: MediaWorkflowType | undefined;

  mediaEssences: MediaEssence[] = [];
  _selectedEssence: MediaEssence | undefined;

  private mediaEssencesSubscription: Subscription | undefined;

  get selectedEssence(): MediaEssence | undefined {
    if (this._selectedEssence && !this.filteredMediaEssences.includes(this._selectedEssence)) {
      this._selectedEssence = undefined;
    }
    return this._selectedEssence;
  }

  set selectedEssence(essence: MediaEssence | undefined) {
    this._selectedEssence = essence;
  }

  get filteredMediaEssences(): MediaEssence[] {
    let acceptedFileExtensions: string[] = [];

    switch (this.selectedWorkflowType) {
      case MediaWorkflowType.AwsCelebrityRecognition:
        acceptedFileExtensions.push("mp4");
        break;
    }

    return this.mediaEssences.filter(e => e.extension && acceptedFileExtensions.includes(e.extension));
  }

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: { mediaAssetGuid: string, mediaAsset: MediaAsset },
    private dataService: DataService,
    private logger: LoggerService,
    private router: Router,
  ) { }

  ngOnInit(): void {
    this.mediaEssencesSubscription = this.dataService.getMediaAssetEssences(this.data.mediaAssetGuid).subscribe(essences => {
      this.mediaEssences = essences.results;
    });
  }

  ngOnDestroy(): void {
    this.mediaEssencesSubscription?.unsubscribe();
  }

  canStartWorkflow() {
    return !!this.data.mediaAsset?.id &&
           !!this.selectedWorkflowType &&
           !!this.selectedEssence;
  }

  startWorkflow() {
    if (this.canStartWorkflow()) {
      this.dataService.createWorkflow(new MediaWorkflow({
        type: this.selectedWorkflowType!,
        mediaAssetId: this.data.mediaAsset.id,
        mediaAssetTitle: this.data.mediaAsset.title,
        input: {
          inputFile: this.selectedEssence!.locators[0]
        }
      })).subscribe(result => {
        this.logger.info(result);
        this.router.navigate(["workflows"]);
      });
    }
  }

  static createDialog(dialog: MatDialog, mediaAssetGuid: string, mediaAsset: MediaAsset, hasBackdrop: boolean = true): MatDialogRef<DialogRunWorkflowComponent> {
    return dialog.open(DialogRunWorkflowComponent, {
      width: "500px",
      autoFocus: false,
      restoreFocus: false,
      disableClose: true,
      hasBackdrop: hasBackdrop,
      data: {
        mediaAssetGuid,
        mediaAsset,
      },
    });
  }

  static closeDialog(uploadDialogRef: MatDialogRef<DialogRunWorkflowComponent>) {
    uploadDialogRef.close();
  }
}
