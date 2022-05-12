import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DialogRunWorkflowComponent } from './dialog-run-workflow.component';

describe('DialogRunWorkflowComponent', () => {
  let component: DialogRunWorkflowComponent;
  let fixture: ComponentFixture<DialogRunWorkflowComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ DialogRunWorkflowComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(DialogRunWorkflowComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
