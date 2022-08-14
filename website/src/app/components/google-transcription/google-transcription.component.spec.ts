import { ComponentFixture, TestBed } from '@angular/core/testing';

import { GoogleTranscriptionComponent } from './google-transcription.component';

describe('GoogleTranscriptionComponent', () => {
  let component: GoogleTranscriptionComponent;
  let fixture: ComponentFixture<GoogleTranscriptionComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ GoogleTranscriptionComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(GoogleTranscriptionComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
