import { NgModule } from "@angular/core";
import { RouterModule, Routes } from "@angular/router";
import { ForgotPasswordComponent, LoginComponent, NewPasswordChallengeComponent } from "./auth";
import { CognitoAuthGuard } from "./guards";
import { AssetAddComponent } from "./pages/asset-add/asset-add.component";
import { WorkflowsComponent } from "./pages/workflows/workflows.component";
import { SettingsComponent } from "./pages/settings/settings.component";
import { BrowseComponent } from "./pages/browse/browse.component";
import { HomeComponent } from "./pages/home/home.component";
import { AssetViewComponent } from "./pages/asset-view/asset-view.component";

const routes: Routes = [
  { path: "login", component: LoginComponent, canActivate: [CognitoAuthGuard] },
  { path: "new-password-challenge", component: NewPasswordChallengeComponent, canActivate: [CognitoAuthGuard] },
  { path: "forgot-password", component: ForgotPasswordComponent, canActivate: [CognitoAuthGuard] },
  {
    path: "", component: HomeComponent, canActivate: [CognitoAuthGuard],
    children: [
      { path: "assets", component: BrowseComponent, canActivate: [CognitoAuthGuard] },
      { path: "assets/add", component: AssetAddComponent, canActivate: [CognitoAuthGuard] },
      { path: "assets/:guid", component: AssetViewComponent, canActivate: [CognitoAuthGuard] },
      { path: "workflows", component: WorkflowsComponent, canActivate: [CognitoAuthGuard] },
      { path: "settings", component: SettingsComponent, canActivate: [CognitoAuthGuard] },

      { path: "**", redirectTo: "assets" }
    ]
  },
];

@NgModule({
  imports: [RouterModule.forRoot(routes, {
    useHash: true
  })],
  exports: [RouterModule]
})
export class AppRoutingModule {
}
