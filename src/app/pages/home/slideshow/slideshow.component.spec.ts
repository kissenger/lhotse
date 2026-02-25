import { TestBed } from '@angular/core/testing';
import { SlideshowComponent } from './slideshow.component';

describe('SlideshowComponent', () => {
  let comp: SlideshowComponent;
  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [SlideshowComponent] }).compileComponents();
    const f = TestBed.createComponent(SlideshowComponent);
    comp = f.componentInstance;
  });

  it('creates slideshow', () => {
    expect(comp).toBeTruthy();
  });
});
