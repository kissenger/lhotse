import { TestBed } from '@angular/core/testing';
import { AboutUsComponent } from './about.component';

describe('AboutUsComponent', () => {
  let comp: AboutUsComponent;
  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [AboutUsComponent] }).compileComponents();
    const f = TestBed.createComponent(AboutUsComponent);
    comp = f.componentInstance;
  });

  it('creates about component', () => {
    expect(comp).toBeTruthy();
  });
});
