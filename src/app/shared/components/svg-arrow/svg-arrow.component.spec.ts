import { TestBed } from '@angular/core/testing';
import { SvgArrowComponent } from './svg-arrow.component';

describe('SvgArrowComponent', () => {
  let comp: SvgArrowComponent;
  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [SvgArrowComponent] }).compileComponents();
    const f = TestBed.createComponent(SvgArrowComponent);
    comp = f.componentInstance;
  });

  it('creates svg-arrow', () => {
    expect(comp).toBeTruthy();
  });
});
