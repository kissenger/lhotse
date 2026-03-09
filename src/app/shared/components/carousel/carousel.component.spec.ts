import { TestBed } from '@angular/core/testing';
import { CarouselComponent } from './carousel.component';

describe('CarouselComponent', () => {
  let comp: CarouselComponent;
  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [CarouselComponent] }).compileComponents();
    const f = TestBed.createComponent(CarouselComponent);
    comp = f.componentInstance;
  });

  it('creates carousel', () => {
    expect(comp).toBeTruthy();
  });
});
