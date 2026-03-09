import { TestBed } from '@angular/core/testing';
import { HeaderComponent } from './header.component';
import { ActivatedRoute, Router } from '@angular/router';
import { DOCUMENT } from '@angular/common';

describe('HeaderComponent', () => {
  let component: HeaderComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HeaderComponent],
      providers: [
        { provide: ActivatedRoute, useValue: {} },
        { provide: Router, useValue: { events: { pipe: () => ({ subscribe: () => {} }) } } },
        { provide: DOCUMENT, useValue: document }
      ]
    }).compileComponents();
    const fixture = TestBed.createComponent(HeaderComponent);
    component = fixture.componentInstance;
  });

  it('should create header and have menuItems', () => {
    expect(component).toBeTruthy();
    expect(component.menuItems.length).toBeGreaterThan(0);
  });

  it('onHamburgerClick toggles menu', () => {
    // provide minimal ViewChild/ViewChildren mocks the method expects
    component.brandBox = { nativeElement: { classList: { remove: () => {} } } } as any;
    component['animateElements'] = { toArray: () => [{ nativeElement: { beginElement: () => {}, getAttribute: () => null, setAttribute: () => {} } }] } as any;
    const before = component.expandDropdownMenu;
    component.onHamburgerClick();
    expect(component.expandDropdownMenu).toBe(!before);
  });
});
