import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AssetWorkflowsComponent } from './asset-workflows.component';

describe('WorkflowsComponent', () => {
  let component: AssetWorkflowsComponent;
  let fixture: ComponentFixture<AssetWorkflowsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ AssetWorkflowsComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(AssetWorkflowsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
