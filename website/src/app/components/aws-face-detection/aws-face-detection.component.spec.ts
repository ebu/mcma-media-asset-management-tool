import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AwsFaceDetectionComponent } from './aws-face-detection.component';

describe('AwsFaceDetectionComponent', () => {
  let component: AwsFaceDetectionComponent;
  let fixture: ComponentFixture<AwsFaceDetectionComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ AwsFaceDetectionComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(AwsFaceDetectionComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
