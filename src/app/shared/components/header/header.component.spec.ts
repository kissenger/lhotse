import { TestBed } from '@angular/core/testing';
import { HeaderComponent } from './header.component';
import { ActivatedRoute, NavigationEnd, Router } from '@angular/router';
import { DOCUMENT } from '@angular/common';
import { Subject } from 'rxjs';
import { ScreenService } from '@shared/services/screen.service';
import { HttpService } from '@shared/services/http.service';

function buildHeader(routerUrl = '/') {
  const routerEvents$ = new Subject<any>();
  const mockRouter = {
    url: routerUrl,
    events: routerEvents$.asObservable()
  };

  const mockScreen = { widthDescriptor: 'small' };
  const mockHttp = { logout: () => Promise.resolve() };

  TestBed.configureTestingModule({
    imports: [HeaderComponent],
    providers: [
      { provide: ActivatedRoute, useValue: {} },
      { provide: Router, useValue: mockRouter },
      { provide: DOCUMENT, useValue: document },
      { provide: ScreenService, useValue: mockScreen },
      { provide: HttpService, useValue: mockHttp }
    ]
  });

  const fixture = TestBed.createComponent(HeaderComponent);
  return { component: fixture.componentInstance, routerEvents$, fixture };
}

describe('HeaderComponent', () => {

  afterEach(() => TestBed.resetTestingModule());

  it('should create header and have menuItems', () => {
    const { component } = buildHeader();
    expect(component).toBeTruthy();
    expect(component.menuItems.length).toBeGreaterThan(0);
  });

  it('onHamburgerClick toggles menu', () => {
    const { component } = buildHeader();
    component.brandBox = { nativeElement: { classList: { remove: () => {} } } } as any;
    component['animateElements'] = { toArray: () => [{ nativeElement: { beginElement: () => {}, getAttribute: () => null, setAttribute: () => {} } }] } as any;
    const before = component.expandDropdownMenu;
    component.onHamburgerClick();
    expect(component.expandDropdownMenu).toBe(!before);
  });

  it('onMenuItemClick closes menu when open', () => {
    const { component } = buildHeader();
    component.expandDropdownMenu = true;
    component.brandBox = { nativeElement: { classList: { remove: () => {} } } } as any;
    component['animateElements'] = { toArray: () => [{ nativeElement: { beginElement: () => {}, getAttribute: () => null, setAttribute: () => {} } }] } as any;
    component.onMenuItemClick();
    expect(component.expandDropdownMenu).toBe(false);
  });

  it('onMenuItemClick does nothing when menu already closed', () => {
    const { component } = buildHeader();
    component.expandDropdownMenu = false;
    component.onMenuItemClick();
    expect(component.expandDropdownMenu).toBe(false);
  });

  it('onLogoLoad sets logoLoaded to true', () => {
    const { component } = buildHeader();
    expect(component.logoLoaded).toBe(false);
    component.onLogoLoad();
    expect(component.logoLoaded).toBe(true);
  });

  // --- syncActiveMenuItemToRoute ---

  it('sets activeMenuItem to Home on root route', () => {
    const { component } = buildHeader('/');
    expect(component.activeMenuItem).toBe('Home');
  });

  it('sets activeMenuItem to Home on /home route', () => {
    const { component } = buildHeader('/home');
    expect(component.activeMenuItem).toBe('Home');
  });

  it('sets activeMenuItem to Map on /map route', () => {
    const { component } = buildHeader('/map');
    expect(component.activeMenuItem).toBe('Map');
  });

  it('sets activeMenuItem to Map on nested /map route', () => {
    const { component } = buildHeader('/map/england/cornwall');
    expect(component.activeMenuItem).toBe('Map');
  });

  it('sets activeMenuItem to Articles on article post route', () => {
    const { component } = buildHeader('/articles/some-post');
    expect(component.activeMenuItem).toBe('Articles');
  });

  it('sets activeMenuItem to undefined on unknown route', () => {
    const { component } = buildHeader('/privacy-policy');
    expect(component.activeMenuItem).toBeUndefined();
  });

  it('sets activeMenuItem from fragment on home route', () => {
    const { component } = buildHeader('/#friends-and-partners');
    expect(component.activeMenuItem).toBe('Home');
  });

  it('sets activeMenuItem to Home when fragment does not match any anchor', () => {
    const { component } = buildHeader('/#unknown-section');
    expect(component.activeMenuItem).toBe('Home');
  });

  // --- NavigationEnd events ---

  it('updates activeMenuItem when router navigates to /map', () => {
    const { component, routerEvents$ } = buildHeader('/');
    routerEvents$.next(new NavigationEnd(1, '/map', '/map'));
    expect(component.activeMenuItem).toBe('Map');
  });

  it('updates activeMenuItem when router navigates to nested /map route', () => {
    const { component, routerEvents$ } = buildHeader('/');
    routerEvents$.next(new NavigationEnd(2, '/map/england/cornwall', '/map/england/cornwall'));
    expect(component.activeMenuItem).toBe('Map');
  });

  it('updates activeMenuItem when router navigates to /shop', () => {
    const { component, routerEvents$ } = buildHeader('/');
    routerEvents$.next(new NavigationEnd(3, '/shop', '/shop'));
    expect(component.activeMenuItem).toBe('Shop');
  });

  it('updates activeMenuItem when router navigates to /faq', () => {
    const { component, routerEvents$ } = buildHeader('/');
    routerEvents$.next(new NavigationEnd(4, '/faq', '/faq'));
    expect(component.activeMenuItem).toBe('FAQs');
  });

  it('clears activeMenuItem when router navigates to non-home route', () => {
    const { component, routerEvents$ } = buildHeader('/');
    routerEvents$.next(new NavigationEnd(5, '/privacy-policy', '/privacy-policy'));
    expect(component.activeMenuItem).toBeUndefined();
  });

  // --- _buildBreadcrumbs / isAdminRoute ---

  it('isAdminRoute is false on normal routes', () => {
    const { component } = buildHeader('/');
    expect(component.isAdminRoute).toBe(false);
  });

  it('isAdminRoute is true on dashboard route', () => {
    const { component } = buildHeader('/dashboard');
    expect(component.isAdminRoute).toBe(true);
  });

  it('isAdminRoute is true on articleeditor route', () => {
    const { component } = buildHeader('/articleeditor');
    expect(component.isAdminRoute).toBe(true);
  });

  it('isAdminRoute is updated on NavigationEnd', () => {
    const { component, routerEvents$ } = buildHeader('/');
    expect(component.isAdminRoute).toBe(false);
    routerEvents$.next(new NavigationEnd(4, '/orders', '/orders'));
    expect(component.isAdminRoute).toBe(true);
  });

  // --- ngOnDestroy ---

  it('ngOnDestroy unsubscribes route subscription', () => {
    const { component } = buildHeader('/');
    const routeSpy = jasmine.createSpy('routeUnsub');
    component['_routeSubs'] = { unsubscribe: routeSpy } as any;
    component.ngOnDestroy();
    expect(routeSpy).toHaveBeenCalled();
  });
});
