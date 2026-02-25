import { TestBed } from '@angular/core/testing';
import { PartnersComponent } from './partners.component';

describe('PartnersComponent', () => {
  let comp: PartnersComponent;
  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [PartnersComponent] }).compileComponents();
    const f = TestBed.createComponent(PartnersComponent);
    comp = f.componentInstance;
  });

  it('creates partners component', () => {
    expect(comp).toBeTruthy();
  });
});
