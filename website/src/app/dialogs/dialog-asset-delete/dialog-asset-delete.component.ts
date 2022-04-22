import { Component, Inject, OnInit } from "@angular/core";
import { MAT_DIALOG_DATA, MatDialog, MatDialogRef } from "@angular/material/dialog";
import { MediaAsset } from "@local/model";
import { DataService } from "../../services";

@Component({
  selector: "app-dialog-asset-delete",
  templateUrl: "./dialog-asset-delete.component.html",
  styleUrls: ["./dialog-asset-delete.component.scss"]
})
export class DialogAssetDeleteComponent implements OnInit {

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: { mediaAsset: MediaAsset },
    private dataService: DataService,
  ) { }

  ngOnInit(): void {
  }

  deleteAsset() {
    if (this.data.mediaAsset.id) {
      this.dataService.deleteMediaAsset(this.data.mediaAsset.id).subscribe();
    }
  }

  static createDialog(dialog: MatDialog, mediaAsset: MediaAsset, hasBackdrop: boolean = true): MatDialogRef<DialogAssetDeleteComponent> {
    return dialog.open(DialogAssetDeleteComponent, {
      width: "500px",
      autoFocus: false,
      restoreFocus: false,
      disableClose: true,
      hasBackdrop: hasBackdrop,
      data: {
        mediaAsset
      },
    });
  }

  static closeDialog(uploadDialogRef: MatDialogRef<DialogAssetDeleteComponent>) {
    uploadDialogRef.close();
  }
}
