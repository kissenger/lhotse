import { ActivatedRoute, RouterLink } from '@angular/router';
import { isPlatformBrowser, NgOptimizedImage } from '@angular/common';
import { AfterViewInit, ChangeDetectorRef, Component, ElementRef, Inject, OnDestroy, PLATFORM_ID, QueryList, ViewChildren } from '@angular/core';
import { Subscription } from 'rxjs';
import { ScreenService } from        '@shared/services/screen.service';
import { ScrollspyService } from     '@shared/services/scrollspy.service';
import { HttpService } from          '@shared/services/http.service';
import { BlogPost } from             '@shared/types';
import { faqFragment, faqItems, faqPreviewExcerpt, type FaqItem } from '@shared/faq-data';
import { SlideshowComponent } from   '@pages/home/slideshow/slideshow.component';
import { AboutUsComponent } from     '@pages/home/about/about.component';
import { PartnersComponent } from    '@pages/home/partners/partners.component';
import { BlogCardComponent } from    '@pages/home/blog/blog-card/blog-card.component';
import { environment } from          '@environments/environment';
import { shopItems } from            '@shared/globals';

@Component({
  standalone: true,
  imports: [
    SlideshowComponent, AboutUsComponent, PartnersComponent, BlogCardComponent,
    RouterLink, NgOptimizedImage
],
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.css']
})

export class HomeComponent implements AfterViewInit, OnDestroy {

  readonly shopPreviewItems = (shopItems || []).slice(0, 2).map((item: any) => ({
    id: item.id,
    name: item.name,
    description: item.description,
    imageSrc: item.images?.[0]?.src ?? '',
    imageAlt: item.images?.[0]?.alt ?? item.name,
  }));

  @ViewChildren('window') windows!: QueryList<ElementRef>;
  @ViewChildren('anchor') anchors!: QueryList<ElementRef>;

  public hideAboutBookOverlay = false;
  public overlayReady = false;
  public deferredSectionsReady = false;
  public latestBlogPreviews: BlogPost[] = [];
  public faqPreviewItems: Array<FaqItem & { fragment: string; excerpt: string }> = [];
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
    private _http: HttpService,
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
      this._loadLatestBlogPreviews();
      this._loadFaqPreviewItems();

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

  private async _loadLatestBlogPreviews() {
    if (!this._isBrowser) {
      return;
    }

    try {
      const posts = await this._http.getPublishedPosts();
      this.latestBlogPreviews = (posts as BlogPost[]).slice(0, 3);
      this._cdr.detectChanges();
    } catch {
      this.latestBlogPreviews = [];
      this._cdr.detectChanges();
    }
  }

  private _loadFaqPreviewItems() {
    const source = [...faqItems];

    const weighted = source
      .map((item) => ({
        item,
        fragment: faqFragment(item.question),
        excerpt: faqPreviewExcerpt(item.answer, 170),
        weight: this._faqPreviewWeight(item.answer)
      }))
      .sort((left, right) => {
        if (left.weight !== right.weight) {
          return right.weight - left.weight;
        }

        return left.item.question.localeCompare(right.item.question);
      })
      .slice(0, 3)
      .map(({ item, fragment, excerpt }) => ({ ...item, fragment, excerpt }));

    this.faqPreviewItems = weighted;
    this._cdr.detectChanges();
  }

  private _faqPreviewWeight(answer: string): number {
    return faqPreviewExcerpt(answer, 1000).length;
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