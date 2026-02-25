import { TestBed } from '@angular/core/testing';
import { BookComponent } from './book.component';

describe('BookComponent', () => {
  let comp: BookComponent;
  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [BookComponent] }).compileComponents();
    const f = TestBed.createComponent(BookComponent);
    comp = f.componentInstance;
  });

  it('creates book component', () => {
    expect(comp).toBeTruthy();
  });
});
