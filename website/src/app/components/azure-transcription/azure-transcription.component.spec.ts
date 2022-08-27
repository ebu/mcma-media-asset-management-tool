import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AzureTranscriptionComponent } from './azure-transcription.component';

describe('AzureTranscriptionComponent', () => {
  let component: AzureTranscriptionComponent;
  let fixture: ComponentFixture<AzureTranscriptionComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ AzureTranscriptionComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(AzureTranscriptionComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
