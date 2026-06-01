import { AfterViewInit, Component, ElementRef, Inject, OnDestroy, QueryList, ViewChild, ViewChildren } from '@angular/core';
import { ScreenService } from '@shared/services/screen.service';
import { filter, Subscription } from 'rxjs';
import { CommonModule } from '@angular/common';
import { Router, RouterLink, NavigationEnd} from '@angular/router';
import { HttpService } from '@shared/services/http.service';

@Component({
  standalone: true,
  imports: [ RouterLink, CommonModule ],
  selector: 'app-header',
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.css']
})

export class HeaderComponent implements AfterViewInit, OnDestroy {

  private static readonly _HOME_PATHS = new Set(['', '/', '/home']);
  private static readonly _MENU_ROUTE_MATCHERS: Array<{ name: string; match: (path: string) => boolean }> = [
    { name: 'Articles', match: (path) => path === '/articles' || path.startsWith('/articles/') || path === '/blog' || path.startsWith('/blog/') },
    { name: 'Book', match: (path) => path === '/snorkelling-britain' },
    { name: 'Shop', match: (path) => path === '/shop' },
    { name: 'Map', match: (path) => path === '/map' || path.startsWith('/map/') },
    { name: 'FAQs', match: (path) => path === '/faqs' }
  ];

  @ViewChildren('animate') animateElements!: QueryList<ElementRef>;
  @ViewChild('brandbox') brandBox!: ElementRef;

  private _routeSubs: Subscription | null = null;

  public menuItems: Array<{name: string, route: string, fragment?: string}> = [
    { name: 'Home',    route: '/',      fragment: 'home' },
    { name: 'Articles', route: '/articles' },
    { name: 'Book',    route: '/snorkelling-britain' },
    { name: 'Shop',    route: '/shop' },
    { name: 'Map',     route: '/map' },
    { name: 'FAQs',    route: '/faqs' },
  ];
  public expandDropdownMenu: boolean = false;
  public activeMenuItem?: string = 'Home';
  public logoLoaded = false;

  public isAdminRoute = false;

  private static readonly _ADMIN_PATHS = new Set([
    'dashboard', 'blogeditor', 'siteseditor', 'adminmap', 'orders', 'login', 'organisations',
  ]);

  constructor(
    @Inject(Router) private _router: Router,
    private _screen: ScreenService,
    private _http: HttpService,
  ) {
    this._routeSubs = this._router.events.pipe(filter((e: any) => e instanceof NavigationEnd))
      .subscribe((event: NavigationEnd) => {
        this.syncActiveMenuItemToRoute(event.urlAfterRedirects);
        this._updateAdminRoute(event.urlAfterRedirects);
    });

    this.syncActiveMenuItemToRoute(this._router.url);
    this._updateAdminRoute(this._router.url);
  }
 
  ngAfterViewInit() {
    if (this._screen.widthDescriptor === 'large') {
      this.expandDropdownMenu = false;
    }
  }
  
  onHamburgerClick() {
    this.brandBox.nativeElement.classList.remove("block-animation");
    this.expandDropdownMenu = !this.expandDropdownMenu;
    this.animateHamburger();
  }

  onMenuItemClick() {
    if (this.expandDropdownMenu) {
      this.expandDropdownMenu = false;
      this.animateHamburger();
    }
  }

  async onAdminNavClick(route: string, fragment?: string) {
    try { await this._http.logout(); } catch {}
    const mainHost = window.location.hostname.replace(/^admin\./, '');
    const port = window.location.port ? `:${window.location.port}` : '';
    const path = route || '/';
    const hash = fragment ? `#${fragment}` : '';
    window.location.href = `${window.location.protocol}//${mainHost}${port}${path}${hash}`;
  }

  onLogoLoad() {
    this.logoLoaded = true;
  }

  animateHamburger() {
    this.animateElements.toArray().forEach( (anim) => {
      anim.nativeElement.beginElement();
    });
    this.toggleAnimationDirection();
  }

  // Reverse svg animation using js - makes svg definition more simple
  toggleAnimationDirection() {
    this.animateElements.toArray().forEach( (anim) => {
      let from = anim.nativeElement.getAttribute("from");
      let to   = anim.nativeElement.getAttribute("to");
      anim.nativeElement.setAttribute('from', to!);
      anim.nativeElement.setAttribute('to', from!);
    });
  }


  ngOnDestroy() {
    this._routeSubs?.unsubscribe();
  }

  private _updateAdminRoute(url: string) {
    const firstSegment = url.split('?')[0].split('#')[0].split('/').filter(Boolean)[0] ?? '';
    this.isAdminRoute = HeaderComponent._ADMIN_PATHS.has(firstSegment);
  }

  private syncActiveMenuItemToRoute(url: string | undefined) {
    if (!url) {
      return;
    }

    const [path, fragment] = url.split('#');
    const normalizedPath = path || '/';
    const isHomeRoute = HeaderComponent._HOME_PATHS.has(normalizedPath);

    const matchedMenu = HeaderComponent._MENU_ROUTE_MATCHERS.find((matcher) => matcher.match(normalizedPath));
    if (matchedMenu) {
      this.activeMenuItem = matchedMenu.name;
      return;
    }

    if (!isHomeRoute) {
      this.activeMenuItem = undefined;
      return;
    }

    const activeMenuItem = this.menuItems.find((item) => item.route === '/' && item.fragment === fragment)?.name;
    this.activeMenuItem = activeMenuItem ?? 'Home';
  }

}
