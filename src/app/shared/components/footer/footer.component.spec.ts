import { TestBed } from '@angular/core/testing';
import { FooterComponent } from './footer.component';

describe('FooterComponent', () => {
  let comp: FooterComponent;
  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [FooterComponent] }).compileComponents();
    const fixture = TestBed.createComponent(FooterComponent);
    comp = fixture.componentInstance;
  });

  it('should create footer and expose year', () => {
    expect(comp).toBeTruthy();
    expect(comp.fullYear).toBeGreaterThan(2000);
  });
});
