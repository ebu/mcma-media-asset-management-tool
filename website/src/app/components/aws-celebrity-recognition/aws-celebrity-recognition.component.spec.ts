import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AwsCelebrityRecognitionComponent } from './aws-celebrity-recognition.component';

describe('AwsCelebrityRecognitionComponent', () => {
  let component: AwsCelebrityRecognitionComponent;
  let fixture: ComponentFixture<AwsCelebrityRecognitionComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ AwsCelebrityRecognitionComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(AwsCelebrityRecognitionComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
