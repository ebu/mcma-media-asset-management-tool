import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AwsTranscriptionComponent } from './aws-transcription.component';

describe('AwsTranscriptionComponent', () => {
  let component: AwsTranscriptionComponent;
  let fixture: ComponentFixture<AwsTranscriptionComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ AwsTranscriptionComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(AwsTranscriptionComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
