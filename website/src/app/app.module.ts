import { NgModule } from "@angular/core";
import { BrowserModule } from "@angular/platform-browser";
import { BrowserAnimationsModule } from "@angular/platform-browser/animations";
import { HttpClientModule } from "@angular/common/http";
import { ReactiveFormsModule } from "@angular/forms";

import { AppRoutingModule } from "./app-routing.module";
import { AppComponent } from "./app.component";
import { MaterialModule } from "./vendor";
import { BrowseComponent } from "./pages/browse/browse.component";
import { AssetAddComponent } from "./pages/asset-add/asset-add.component";
import { WorkflowsComponent } from "./pages/workflows/workflows.component";
import { SettingsComponent } from "./pages/settings/settings.component";
import { HomeComponent } from "./pages/home/home.component";
import { DialogsModule } from "./dialogs/dialogs.module";
import { httpInterceptorProviders } from "./http-interceptors";
import { AssetViewComponent } from "./pages/asset-view/asset-view.component";
import { AssetFilesComponent } from "./components/asset-files/asset-files.component";
import { AssetWorkflowsComponent } from "./components/asset-workflows/asset-workflows.component";
import { AsModule, DurationModule, FilesizeModule } from "./pipes";
import { AwsCelebrityRecognitionComponent } from "./components/aws-celebrity-recognition/aws-celebrity-recognition.component";

@NgModule({
  declarations: [
    AppComponent,
    BrowseComponent,
    AssetAddComponent,
    WorkflowsComponent,
    SettingsComponent,
    HomeComponent,
    AssetViewComponent,
    AssetFilesComponent,
    AssetWorkflowsComponent,
    AwsCelebrityRecognitionComponent,
  ],
  imports: [
    AppRoutingModule,
    BrowserAnimationsModule,
    BrowserModule,
    DialogsModule,
    HttpClientModule,
    MaterialModule,
    ReactiveFormsModule,
    AsModule,
    DurationModule,
    FilesizeModule,
  ],
  providers: [
    httpInterceptorProviders
  ],
  bootstrap: [AppComponent]
})
export class AppModule {
}
