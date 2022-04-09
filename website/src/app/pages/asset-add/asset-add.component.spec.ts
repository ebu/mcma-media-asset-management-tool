import { ComponentFixture, TestBed } from "@angular/core/testing";

import { AssetAddComponent } from "./asset-add.component";

describe("AddAssetComponent", () => {
  let component: AssetAddComponent;
  let fixture: ComponentFixture<AssetAddComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [AssetAddComponent]
    })
      .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(AssetAddComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it("should create", () => {
    expect(component).toBeTruthy();
  });
});
