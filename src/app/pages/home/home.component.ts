import { ActivatedRoute, RouterLink } from '@angular/router';
import { isPlatformBrowser, NgOptimizedImage } from '@angular/common';
import { AfterViewInit, ChangeDetectorRef, Component, ElementRef, Inject, OnDestroy, PLATFORM_ID, QueryList, ViewChildren } from '@angular/core';
import { Subscription } from 'rxjs';
import { ScreenService } from        '@shared/services/screen.service';
import { ScrollspyService } from     '@shared/services/scrollspy.service';
import { SlideshowComponent } from   '@pages/home/slideshow/slideshow.component';
import { AboutUsComponent } from     '@pages/home/about/about.component';
import { BlogComponent } from        '@pages/home/blog/blog.component';
import { BookComponent } from        '@pages/home/book/book.component';
import { ShopComponent } from        '@pages/home/shop/shop.component';
import { FAQComponent } from         '@pages/home/faq/faq.component';
import { MapComponent } from         '@pages/home/map/map.component';
import { PartnersComponent } from    '@pages/home/partners/partners.component';
import { environment } from          '@environments/environment';

@Component({
  standalone: true,
  imports: [
    SlideshowComponent, AboutUsComponent, ShopComponent, MapComponent,
    FAQComponent, BlogComponent, PartnersComponent, BookComponent,
    RouterLink, NgOptimizedImage
],
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.css']
})

export class HomeComponent implements AfterViewInit, OnDestroy {

  @ViewChildren('window') windows!: QueryList<ElementRef>;
  @ViewChildren('anchor') anchors!: QueryList<ElementRef>;

  public hideAboutBookOverlay = false;
  public overlayReady = false;
  public deferredSectionsReady = false;
  public widthDescriptor?: string;
  private _subs: Subscription[] = [];
  private _fragmentScrollTimer?: ReturnType<typeof setTimeout>;
  private _idleCallbackId?: number;
  private _idleTimeoutId?: ReturnType<typeof setTimeout>;
  private readonly _isBrowser: boolean;
  private static readonly _VISITED_COOKIE = 'sn_visited';

  readonly panelConfig: Record<string, { path: string }> = {
    windowOne:   { path: "photos/parallax/scorpionfish-photographed-while-snorkelling-in-cornwall" },
    windowTwo:   { path: "photos/parallax/cuddling-crabs-snorkelling-scotland-britain" },
    windowThree: { path: "photos/parallax/child-in-snorkelling-gear-scotland" },
    windowFour:  { path: "photos/parallax/dahlia-anemone-snorkelling-dorset-britain" },
    windowFive:  { path: "photos/parallax/scorpionfish-photographed-while-snorkelling-in-cornwall" },
    windowSix:   { path: "photos/parallax/cuddling-crabs-snorkelling-scotland-britain" },
  }

  private _imgixBase = `https://${environment.IMGIX_DOMAIN}`;

  constructor(
    @Inject(PLATFORM_ID) private platformId: any,
    private _route: ActivatedRoute,
    private _scrollSpy: ScrollspyService,
    private _screen: ScreenService,
    private _cdr: ChangeDetectorRef,
  ) {
    this._isBrowser = isPlatformBrowser(this.platformId);
  }

  ngAfterViewInit() {
    if (this._isBrowser) {
      // Background images are loaded lazily via windows.changes when deferred sections render.

      // Hide book overlay for returning visitors (non-tracking, functional cookie)
      if (document.cookie.split(';').some(c => c.trim().startsWith(HomeComponent._VISITED_COOKIE + '='))) {
        this.hideAboutBookOverlay = true;
      } else {
        document.cookie = `${HomeComponent._VISITED_COOKIE}=1; max-age=${60 * 60 * 24 * 365}; path=/; SameSite=Lax`;
      }

      // Delay fragment scroll until deferred sections have had a chance to render.
      this._fragmentScrollTimer = setTimeout(() => {
        const fragment = this._route.snapshot.fragment;
        if (!fragment) {
          return;
        }
        document.querySelector(`#${fragment}`)?.scrollIntoView();
      }, 500);
    }

    // Scrollspy is non-critical for first paint; initialize during idle.
    this._scheduleNonCritical(() => {
      this.deferredSectionsReady = true;
      this._cdr.detectChanges();

      this._subs.push(this._scrollSpy.intersectionEmitter.subscribe((isect) => {
        if (!this.hideAboutBookOverlay && isect.id !== 'home') {
          this.hideAboutBookOverlay = true;
          this._cdr.detectChanges();
        }
      }));

      // Observe initial anchors and keep observing when deferred views render.
      this._scrollSpy.observeChildren(this.anchors);
      this._subs.push(this.anchors.changes.subscribe(() => {
        this._scrollSpy.observeChildren(this.anchors);
      }));

      // Load all static window backgrounds together after first paint.
      this.loadBackgroundImages();
    });

    if (!this._isBrowser) {
      return;
    }

    //watch for changes as querylist will change when deferred views are loaded
    this._subs.push(this.windows.changes.subscribe(() => {
      this._loadAllWindowBackgrounds();
    }));

    this._loadAllWindowBackgrounds();
 
    this.widthDescriptor = this._screen.widthDescriptor;
    this._subs.push(this._screen.resize.subscribe((hasOrientationChanged) => {
      this.widthDescriptor = this._screen.widthDescriptor;
      if (hasOrientationChanged) {
        this.loadBackgroundImages();
      }
    }));

  }

  private _scheduleNonCritical(task: () => void) {
    if (!this._isBrowser) {
      return;
    }

    const requestIdle = window.requestIdleCallback?.bind(window);
    if (requestIdle) {
      this._idleCallbackId = requestIdle(() => {
        this._idleCallbackId = undefined;
        task();
      }, { timeout: 1500 });
      return;
    }

    this._idleTimeoutId = setTimeout(() => {
      this._idleTimeoutId = undefined;
      task();
    }, 300);
  }

  private _loadAllWindowBackgrounds() {
    this.windows.forEach(w => {
      if (!w.nativeElement.style.backgroundImage) {
        this._loadWindowBackground(w.nativeElement);
      }
    });
  }

  private _loadWindowBackground(el: HTMLElement) {
    if (!this._isBrowser) return;

    const panel = this.panelConfig[el.id];
    if (!panel) return;
    const orientation = this._screen.deviceOrientation;
    const dpr = Math.min(window.devicePixelRatio ?? 1, 2);
    const width = Math.round(this._screen.width * dpr);
    const height = Math.round(this._screen.height * 0.8 * dpr);
    const url = `${this._imgixBase}${panel.path}-${orientation}.webp?w=${width}&h=${height}&fm=webp&auto=compress&fit=crop&q=40`;
    el.style.backgroundImage = `url('${url}')`;
    el.style.backgroundSize = 'cover';
    el.style.backgroundPosition = 'center';
  }

  // Called on orientation change: reload already-visible panels and re-observe the rest.
  loadBackgroundImages() {
    this.windows.forEach(w => {
      if (w.nativeElement.style.backgroundImage) {
        w.nativeElement.style.backgroundImage = '';
      }
    });
    this._loadAllWindowBackgrounds();
  }

  hideOverlay(overlay: string) {
    if (overlay === 'about-book') {
      this.hideAboutBookOverlay = true;
      // Ensure overlay stays hidden on future visits
      if (this._isBrowser) {
        document.cookie = `${HomeComponent._VISITED_COOKIE}=1; max-age=${60 * 60 * 24 * 365}; path=/; SameSite=Lax`;
      }
    }
  }

  ngOnDestroy() {
    this._subs.forEach((sub) => sub.unsubscribe());
    if (this._isBrowser && this._idleCallbackId !== undefined && window.cancelIdleCallback) {
      window.cancelIdleCallback(this._idleCallbackId);
    }
    if (this._idleTimeoutId) {
      clearTimeout(this._idleTimeoutId);
    }
    if (this._fragmentScrollTimer) {
      clearTimeout(this._fragmentScrollTimer);
    }
  }

}