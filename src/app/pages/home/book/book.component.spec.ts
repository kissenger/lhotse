import { TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { BookComponent } from './book.component';

describe('BookComponent', () => {
  let comp: BookComponent;
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BookComponent],
      providers: [{ provide: ActivatedRoute, useValue: { snapshot: { params: {} }, paramMap: { get: () => null } } }]
    }).compileComponents();
    const f = TestBed.createComponent(BookComponent);
    comp = f.componentInstance;
  });

  it('creates book component', () => {
    expect(comp).toBeTruthy();
  });
});
