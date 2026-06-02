import { RouterLink } from '@angular/router';
import { isPlatformBrowser, NgOptimizedImage } from '@angular/common';
import { AfterViewInit, Component, ElementRef, Inject, OnDestroy, PLATFORM_ID, QueryList, ViewChildren } from '@angular/core';
import { Subscription } from 'rxjs';
import { ScreenService } from        '@shared/services/screen.service';
import { HttpService } from          '@shared/services/http.service';
import { BlogPost } from             '@shared/types';
import { faqFragment, faqItems, faqPreviewExcerpt, featuredFaqQuestions, type FaqItem } from '@shared/faq-data';
import { SlideshowComponent } from   '@pages/home/slideshow/slideshow.component';
import { AboutUsComponent } from     '@pages/home/about/about.component';
import { PartnersComponent } from    '@pages/home/partners/partners.component';
import { BlogCardComponent } from    '@pages/home/blog/blog-card/blog-card.component';
import { environment } from          '@environments/environment';
import { shopItems } from            '@shared/globals';
import { IdleSchedulerService } from '@shared/services/idle-scheduler.service';
import { appImageUrl } from          '@shared/utils/image-url';

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

  public blogPreviewLoading = true;
  public faqPreviewLoading = true;
  public latestBlogPreviews: BlogPost[] = [];
  public faqPreviewItems: Array<FaqItem & { fragment: string; excerpt: string }> = [];
  private _subs: Subscription[] = [];
  private _cancelNonCriticalTask?: () => void;
  private readonly _isBrowser: boolean;
  private readonly _faqItemsByQuestion = new Map(faqItems.map((item) => [item.question, item] as const));

  readonly panelConfig: Record<string, { path: string }> = {
    windowOne:   { path: "photos/parallax/scorpionfish-photographed-while-snorkelling-in-cornwall" },
    windowTwo:   { path: "photos/parallax/cuddling-crabs-snorkelling-scotland-britain" },
    windowThree: { path: "photos/parallax/child-in-snorkelling-gear-scotland" },
    windowFour:  { path: "photos/parallax/dahlia-anemone-snorkelling-dorset-britain" },
    windowFive:  { path: "photos/parallax/scorpionfish-photographed-while-snorkelling-in-cornwall" },
    windowSix:   { path: "photos/parallax/cuddling-crabs-snorkelling-scotland-britain" },
  }

  constructor(
    @Inject(PLATFORM_ID) private platformId: any,
    private _screen: ScreenService,
    private _http: HttpService,
    @Inject(IdleSchedulerService) private _idleScheduler: IdleSchedulerService,
  ) {
    this._isBrowser = isPlatformBrowser(this.platformId);
  }

  ngAfterViewInit() {
    // Overlay removed. Keep cookie-setting lines commented for future reuse.
    // if (this._isBrowser) {
    //   document.cookie = `sn_visited=1; max-age=${60 * 60 * 24 * 365}; path=/; SameSite=Lax`;
    // }

    // Fetch dynamic preview content immediately so the home previews appear quickly.
    this._loadLatestBlogPreviews();
    this._loadFaqPreviewItems();

    // Keep background image setup as non-critical work.
    this._cancelNonCriticalTask = this._idleScheduler.schedule(() => {
      this.loadBackgroundImages();
    });

    if (!this._isBrowser) {
      return;
    }

    // Watch for deferred section mounts and load newly rendered backgrounds.
    this._subs.push(this.windows.changes.subscribe(() => {
      this._loadAllWindowBackgrounds();
    }));

    this._loadAllWindowBackgrounds();
 
    this._subs.push(this._screen.resize.subscribe((hasOrientationChanged) => {
      if (hasOrientationChanged) {
        this.loadBackgroundImages();
      }
    }));

  }

  private async _loadLatestBlogPreviews() {
    if (!this._isBrowser) {
      this.blogPreviewLoading = false;
      return;
    }

    try {
      const posts = await this._http.getPublishedPosts();
      this.latestBlogPreviews = (posts as BlogPost[]).slice(0, 3);
    } catch {
      this.latestBlogPreviews = [];
    } finally {
      this.blogPreviewLoading = false;
    }
  }

  private _loadFaqPreviewItems() {
    const selected = featuredFaqQuestions
      .map((question) => this._faqItemsByQuestion.get(question))
      .filter((item): item is FaqItem => item !== undefined)
      .map((item) => ({
        ...item,
        fragment: faqFragment(item.question),
        excerpt: faqPreviewExcerpt(item.answer, 170),
      }));

    this.faqPreviewItems = selected;
    this.faqPreviewLoading = false;
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
    const url = appImageUrl(`${panel.path}-${orientation}.webp`, {
      stage: environment.STAGE,
      width,
      height,
      format: 'webp',
      fit: 'cover',
      quality: 40,
    });
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

  ngOnDestroy() {
    this._subs.forEach((sub) => sub.unsubscribe());
    this._cancelNonCriticalTask?.();
  }

}