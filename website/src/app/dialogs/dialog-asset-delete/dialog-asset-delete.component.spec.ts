import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DialogAssetDeleteComponent } from './dialog-asset-delete.component';

describe('DialogAssetDeleteComponent', () => {
  let component: DialogAssetDeleteComponent;
  let fixture: ComponentFixture<DialogAssetDeleteComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ DialogAssetDeleteComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(DialogAssetDeleteComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
