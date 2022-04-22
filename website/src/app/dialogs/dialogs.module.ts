import { NgModule } from "@angular/core";
import { CommonModule } from "@angular/common";
import { MaterialModule } from "../vendor";
import { FilesizeModule } from "../pipes";

import { DialogAssetIngestComponent } from "./dialog-asset-ingest";
import { DialogSessionExpiredComponent } from "./dialog-session-expired";
import { DialogUploadComponent } from "./dialog-upload";
import { DialogAssetDeleteComponent } from './dialog-asset-delete/dialog-asset-delete.component';

@NgModule({
  declarations: [
    DialogAssetIngestComponent,
    DialogSessionExpiredComponent,
    DialogUploadComponent,
    DialogAssetDeleteComponent,
  ],
  imports: [
    CommonModule,
    MaterialModule,
    FilesizeModule,
  ],
  exports: [
    DialogUploadComponent,
    DialogSessionExpiredComponent,
    DialogAssetIngestComponent,
  ]
})
export class DialogsModule {}
