import { AfterViewInit, ChangeDetectorRef, Component, ElementRef, Inject, OnDestroy, QueryList, ViewChild, ViewChildren } from '@angular/core';
import { ScrollspyService } from '@shared/services/scrollspy.service';
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

  @ViewChildren('animate') animateElements!: QueryList<ElementRef>;
  @ViewChild('brandbox') brandBox!: ElementRef;

  private _scrSubs: Subscription | null = null;
  private _routeSubs: Subscription | null = null;

  public menuItems: Array<{name: string, anchor: string, route: string}> = [
    { name: 'Home',    anchor: 'home',                       route: '/' },
    { name: 'Blog',    anchor: 'blog',                       route: '/' },
    { name: 'Book',    anchor: 'snorkelling-britain',        route: '/' },
    { name: 'Shop',    anchor: 'buy-now',                    route: '/' },
    { name: 'Map',     anchor: 'snorkelling-map-of-britain', route: '/' },
    { name: 'Friends', anchor: 'friends-and-partners',       route: '/' },
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
    private _scrollSpy: ScrollspyService,
    private _screen: ScreenService,
    private _cdr: ChangeDetectorRef,
    private _http: HttpService,
  ) {
    this._scrSubs = this._scrollSpy.intersectionEmitter.subscribe((isect) => {
      const activeMenuItem = this.menuItems.find((item) => item.anchor === isect.id)?.name;
      if (activeMenuItem) {
        this.activeMenuItem = activeMenuItem;
        this._cdr.detectChanges();
      }
    });

    this._routeSubs = this._router.events.pipe(filter((e: any) => e instanceof NavigationEnd))
      .subscribe((event: NavigationEnd) => {
        this.syncActiveMenuItemToRoute(event.urlAfterRedirects);
        this._updateAdminRoute(event.urlAfterRedirects);
        this._cdr.detectChanges();
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

  async onAdminNavClick(anchor: string) {
    try { await this._http.logout(); } catch {}
    const mainHost = window.location.hostname.replace(/^admin\./, '');
    const port = window.location.port ? `:${window.location.port}` : '';
    window.location.href = `${window.location.protocol}//${mainHost}${port}/#${anchor}`;
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
    this._scrSubs?.unsubscribe();
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
    const isHomeRoute = path === '/' || path === '/home' || path === '';
    const isMapRoute = path === '/map';

    if (isMapRoute) {
      this.activeMenuItem = 'Map';
      return;
    }

    if (!isHomeRoute) {
      this.activeMenuItem = undefined;
      return;
    }

    const activeMenuItem = this.menuItems.find((item) => item.anchor === fragment)?.name;
    this.activeMenuItem = activeMenuItem ?? 'Home';
  }

}
