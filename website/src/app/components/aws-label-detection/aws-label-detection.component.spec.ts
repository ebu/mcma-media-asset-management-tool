import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AwsLabelDetectionComponent } from './aws-label-detection.component';

describe('AwsLabelDetectionComponent', () => {
  let component: AwsLabelDetectionComponent;
  let fixture: ComponentFixture<AwsLabelDetectionComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ AwsLabelDetectionComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(AwsLabelDetectionComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
