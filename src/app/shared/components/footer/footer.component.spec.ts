import { TestBed } from '@angular/core/testing';
import { FooterComponent } from './footer.component';
import { RouterTestingModule } from '@angular/router/testing';

describe('FooterComponent', () => {
  let comp: FooterComponent;
  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [FooterComponent, RouterTestingModule] }).compileComponents();
    const fixture = TestBed.createComponent(FooterComponent);
    comp = fixture.componentInstance;
  });

  it('should create footer and expose year', () => {
    expect(comp).toBeTruthy();
    expect(comp.fullYear).toBeGreaterThan(2000);
  });
});
