import { NgModule } from "@angular/core";
import { CommonModule } from "@angular/common";
import { AsPipe } from "./as.pipe";

@NgModule({
  declarations: [
    AsPipe
  ],
  imports: [
    CommonModule
  ],
  exports: [
    AsPipe
  ]
})
export class AsModule {}
