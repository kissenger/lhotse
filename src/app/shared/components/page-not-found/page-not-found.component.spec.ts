import { TestBed } from '@angular/core/testing';
import { PageNotFoundComponent } from './page-not-found.component';

describe('PageNotFoundComponent', () => {
  let comp: PageNotFoundComponent;
  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [PageNotFoundComponent] }).compileComponents();
    const f = TestBed.createComponent(PageNotFoundComponent);
    comp = f.componentInstance;
  });

  it('creates page-not-found', () => {
    expect(comp).toBeTruthy();
  });
});
