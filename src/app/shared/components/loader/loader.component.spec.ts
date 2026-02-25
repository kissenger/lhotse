import { TestBed } from '@angular/core/testing';
import { LoaderComponent } from './loader.component';

describe('LoaderComponent', () => {
  let comp: LoaderComponent;
  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [LoaderComponent] }).compileComponents();
    const f = TestBed.createComponent(LoaderComponent);
    comp = f.componentInstance;
  });

  it('should create loader', () => {
    expect(comp).toBeTruthy();
  });
});
