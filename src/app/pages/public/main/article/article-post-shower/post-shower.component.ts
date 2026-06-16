import { ChangeDetectorRef, Component, Inject, OnDestroy, OnInit, PLATFORM_ID } from '@angular/core';
import { HttpService } from '@shared/services/http.service';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Subscription, combineLatest, switchMap, tap } from 'rxjs';
import { ArticlePost } from '@shared/types';
import { CommonModule, NgOptimizedImage, isPlatformBrowser } from '@angular/common';
import { KebaberPipe } from '@shared/pipes/kebaber.pipe';
import { HtmlerPipe } from '@shared/pipes/htmler.pipe';
import { SanitizerPipe } from '@shared/pipes/sanitizer.pipe';
import { LoaderComponent } from '@shared/components/loader/loader.component';
import { AffiliateBoxComponent } from '../../../../../shared/affiliate-box/affiliate-box.component';
import { stage } from '@shared/globals';
import { DomSanitizer } from '@angular/platform-browser';
import { buildYouTubeEmbedUrl } from '@shared/utils/youtube-url';

@Component({
  selector: 'app-post-shower',
  standalone: true,
  providers: [HtmlerPipe, SanitizerPipe, KebaberPipe],
  templateUrl: './post-shower.component.html',
  styleUrl: './post-shower.component.css',
  imports: [KebaberPipe, SanitizerPipe, CommonModule, RouterLink, NgOptimizedImage, LoaderComponent, AffiliateBoxComponent]
})

export class PostShowerComponent implements OnDestroy, OnInit {
  post: ArticlePost;
  isReadyToLoad: boolean;
  contentVisible: boolean;
  loadingState: 'loading' | 'failed' | 'success' = 'loading';
  nextSlug: string;
  lastSlug: string = '';
  nextTitle: string = '';
  lastTitle: string = '';
  stage: any = stage;
  showUpdatedAt: boolean = false;
  likeCount: number = 0;
  hasLiked: boolean = false;
  isPreview: boolean = false;
  isAdminHost: boolean = false;
  reviewSummaryHtml: string = '';
  affiliateDisclosureHtml: string = '';
  showFloatingBackToContents: boolean = false;
  private readonly _isBrowser: boolean;
  private _routeSubs: Subscription | undefined;
  private _contentsObserver?: IntersectionObserver;
  private _contentsObserverRetryTimer?: number;
  private _hasSeenContentsInViewport: boolean = false;

  constructor(
    private _http: HttpService,
    private _route: ActivatedRoute,
    private _htmler: HtmlerPipe,
    private _kebaber: KebaberPipe,
    private _router: Router,
    private sanitizer: DomSanitizer,
    private _cdr: ChangeDetectorRef,
    @Inject(PLATFORM_ID) platformId: object
  ) {
    this.post = new ArticlePost();
    this.isReadyToLoad = false;
    this.contentVisible = false;
    this.nextSlug = '';
    this.lastSlug = '';
    this.nextTitle = '';
    this.lastTitle = '';
    this.stage = stage;
    this._isBrowser = isPlatformBrowser(platformId);
  }

  private async _fetchPost(slug: string): Promise<any> {
    if (this.isPreview) {
      const postResult = await Promise.race([
        this._http.getPostBySlug(slug, true),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), 15000))
      ]);
      return { ...postResult, nextSlug: '', lastSlug: '' };
    }
    const [postResult, slugResult] = await Promise.race([
      Promise.all([
        this._http.getPostBySlug(slug, false),
        this._http.getLastAndNextSlugs(slug)
      ]),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), 15000))
    ]);
    return { ...postResult, ...slugResult };
  }

  private _resolveImagePath(path: string): string {
    const rawPath = (path || '').trim();
    if (!rawPath) return '';
    if (/^(https?:)?\/\//i.test(rawPath) || rawPath.startsWith('data:') || rawPath.startsWith('blob:')) {
      return rawPath;
    }

    const normalized = rawPath.replace(/^\/+/, '');

    // Keep already-transformed Cloudflare paths untouched.
    if (normalized.startsWith('cdn-cgi/image/')) {
      return `/${normalized}`;
    }

    // Localhost plain <img src> needs explicit /assets paths.
    if (this.usePlainSrcImages || this.isPreview) {
      const withoutAssetsPrefix = normalized.replace(/^assets\//, '');
      return `/assets/${withoutAssetsPrefix}`;
    }

    if (!this.isPreview) {
      return rawPath;
    }

    return `/${normalized}`;
  }

  get heroImageSrc(): string {
    return this._resolveImagePath(this.post.imgFname || '');
  }

  sectionImageSrc(path: string): string {
    return this._resolveImagePath(path || '');
  }

  get reviewImageSrc(): string {
    return this._resolveImagePath(this.post.review?.imageFname || '');
  }

  get reviewImageAltText(): string {
    const review = this.post.review as any;
    return (review?.imageAlt || review?.imgAlt || review?.productName || this.post.title || '').trim();
  }

  get reviewImageCreditText(): string {
    const review = this.post.review as any;
    return (review?.imageCredit || review?.imgCredit || '').trim();
  }

  get usePlainSrcImages(): boolean {
    if (!this._isBrowser) {
      return false;
    }
    const host = window.location.hostname.toLowerCase();
    return host === 'localhost' || host === '127.0.0.1' || host === '::1';
  }

  get isReviewPost(): boolean {
    return this.post.type === 'review';
  }

  get reviewLabel(): 'Book' | 'Product' {
    return this.post.review?.reviewKind === 'book' ? 'Book' : 'Product';
  }

  get isBookReview(): boolean {
    return this.post.review?.reviewKind === 'book';
  }

  get reviewComputedRating(): number {
    const cats = this.post.review?.ratingCategories;
    if (cats?.length) {
      const avg = cats.reduce((s: number, c: any) => s + c.value, 0) / cats.length;
      return Math.round(avg * 10) / 10;
    }
    return this.post.review?.ratingValue || 0;
  }

  get ratingDisplayFormat(): string {
    return (this.post.review?.ratingCategories?.length ?? 0) > 0 ? '1.0-1' : '1.0-0';
  }

  get reviewStarScale(): number {
    const scale = Number(this.post.review?.ratingScale || 5);
    if (!Number.isFinite(scale) || scale <= 0) {
      return 5;
    }
    return Math.max(1, Math.round(scale));
  }

  get reviewStarsFillPercent(): number {
    const scale = this.reviewStarScale;
    const value = Number(this.reviewComputedRating || 0);
    const clamped = Math.max(0, Math.min(scale, value));
    return (clamped / scale) * 100;
  }

  get reviewStarsScaleArray(): number[] {
    return Array.from({ length: this.reviewStarScale }, (_, i) => i);
  }

  reviewStarFillPercent(starIndex: number): number {
    const value = Number(this.reviewComputedRating || 0);
    const starValue = value - starIndex;
    return Math.max(0, Math.min(1, starValue)) * 100;
  }

  get reviewCategoryStarScaleArray(): number[] {
    return [0, 1, 2, 3, 4];
  }

  reviewCategoryStarFillPercent(value: number, starIndex: number): number {
    const numeric = Number(value || 0);
    const clamped = Math.max(0, Math.min(5, numeric));
    const starValue = clamped - starIndex;
    return Math.max(0, Math.min(1, starValue)) * 100;
  }

  categoryAnchor(catName: string): string {
    return this._kebaber.transform(catName);
  }

  sectionAffiliateUrl(section: any): string | null {
    const url = (section?.affiliateUrl || '').trim();
    return url || null;
  }

  sectionAffiliateLabel(section: any): string {
    const label = (section?.affiliateLabel || '').trim();
    return label || 'View offer';
  }

  get showContents(): boolean {
    const contentSections = (this.post.sections || []).filter((section: any) => section.sectionType !== 'cta');
    if (contentSections.length === 0) {
      return false;
    }
    if (contentSections.length === 1 && !(contentSections[0]?.title || '').trim()) {
      return false;
    }
    return true;
  }

  private _normaliseReviewModel(review: any) {
    const defaults = new ArticlePost().review;
    const model = {
      ...defaults,
      ...(review || {}),
      pros: Array.isArray(review?.pros) ? review.pros.filter((x: any) => !!x) : [],
      cons: Array.isArray(review?.cons) ? review.cons.filter((x: any) => !!x) : [],
      affiliateLinks: Array.isArray(review?.affiliateLinks) ? review.affiliateLinks.filter((x: any) => !!x?.label && !!x?.url) : []
    };

    model.ratingScale = Math.max(1, Number(model.ratingScale || 5));
    model.ratingValue = Math.min(model.ratingScale, Math.max(0, Number(model.ratingValue || 0)));
    return model;
  }

  ngOnInit() {
    // Do not block SSR on API calls for article body content; render quickly and hydrate on client.
    if (!this._isBrowser) {
      return;
    }

    this.isAdminHost = window.location.hostname.startsWith('admin.');
    this._routeSubs = combineLatest([this._route.params, this._route.queryParamMap])
      .pipe(
        tap(([_, queryParamMap]) => {
          this.isPreview = queryParamMap.has('preview');
          this.isReadyToLoad = false;
          this.contentVisible = false;
          this.loadingState = 'loading';
          this._cdr.detectChanges();
        }),
        switchMap(async ([params]: [{ [key: string]: string }, any]) => {
          const slug = params['slug'];
          return this._fetchPost(slug);
        })
      )
      .subscribe({
        
        next: (result: any) => {
          if (!result || !result.article) {
            
            this._router.navigateByUrl(`${this._router.url}/404`);
            return;
          }

          this.post = result.article;
          this.post.review = this._normaliseReviewModel(result.article.review);
          this.reviewSummaryHtml = this._htmler.transform(this.post.review.summary || '');
          this.affiliateDisclosureHtml = this._htmler.transform(this.post.review.affiliateDisclosure || '');
          this.post.intro = this._htmler.transform(result.article.intro ?? '');
          this.post.conclusion = this._htmler.transform(result.article.conclusion ?? '');
          this.post.sections = (result.article.sections ?? []).map((s: any) => ({
            title: s.title ?? '',
            content: this._htmler.transform(s.content ?? ''),
            imgFname: s.imgFname ?? '',
            imgAlt: s.imgAlt ?? '',
            imgCredit: s.imgCredit ?? '',
            affiliateLabel: s.affiliateLabel ?? '',
            affiliateUrl: s.affiliateUrl ?? '',
            videoUrl: !!s.videoUrl ? this.sanitizer.bypassSecurityTrustResourceUrl(buildYouTubeEmbedUrl(s.videoUrl)) : '',
            videoOrientation: s.videoOrientation ?? 'landscape',
            sectionType: s.sectionType,
            ctaLinks: s.ctaLinks
          }));
          this.nextSlug = result.nextSlug ?? '';
          this.lastSlug = result.lastSlug ?? '';
          this.nextTitle = result.nextTitle ?? '';
          this.lastTitle = result.lastTitle ?? '';
          this.isReadyToLoad = true;
          this.contentVisible = (this.isPreview && !this.heroImageSrc);
          this.loadingState = 'success';
          this.likeCount = this.post.likes ?? 0;
          this.hasLiked = this.likeCount > 0 && this._hasLikedInStorage(this.post.slug);
          const publishedDate = this.post.publishedAt ? new Date(this.post.publishedAt) : null;
          const updatedDate = new Date(this.post.updatedAt);
          this.showUpdatedAt = publishedDate !== null && (
            updatedDate.getFullYear() !== publishedDate.getFullYear() ||
            updatedDate.getMonth() !== publishedDate.getMonth()
          );
          this._setupContentsObserver();
          this._cdr.detectChanges();
        },
        error: () => {
          this.loadingState = 'failed';
          this._cdr.detectChanges();
        }
      });
  }

  onHeroImageLoaded() {
    this.contentVisible = true;
    this._cdr.detectChanges();
  }

  onRetry() {
    this.isPreview = this._route.snapshot.queryParamMap.has('preview');
    this.loadingState = 'loading';
    this.isReadyToLoad = false;
    this.contentVisible = false;
    const slug = this._route.snapshot.params['slug'];
    this._fetchPost(slug).then((result: any) => {
      if (!result || !result.article) {
        this._router.navigateByUrl(`${this._router.url}/404`);
        return;
      }
      this.post = result.article;
      this.post.review = this._normaliseReviewModel(result.article.review);
      this.reviewSummaryHtml = this._htmler.transform(this.post.review.summary || '');
      this.affiliateDisclosureHtml = this._htmler.transform(this.post.review.affiliateDisclosure || '');
      this.post.intro = this._htmler.transform(result.article.intro ?? '');
      this.post.conclusion = this._htmler.transform(result.article.conclusion ?? '');
      this.post.sections = (result.article.sections ?? []).map((s: any) => ({
        title: s.title ?? '',
        content: this._htmler.transform(s.content ?? ''),
        imgFname: s.imgFname ?? '',
        imgAlt: s.imgAlt ?? '',
        imgCredit: s.imgCredit ?? '',
        affiliateLabel: s.affiliateLabel ?? '',
        affiliateUrl: s.affiliateUrl ?? '',
        videoUrl: !!s.videoUrl ? this.sanitizer.bypassSecurityTrustResourceUrl(buildYouTubeEmbedUrl(s.videoUrl)) : '',
        videoOrientation: s.videoOrientation ?? 'landscape',
        sectionType: s.sectionType,
        ctaLinks: s.ctaLinks
      }));
      this.nextSlug = result.nextSlug ?? '';
      this.lastSlug = result.lastSlug ?? '';
      this.nextTitle = result.nextTitle ?? '';
      this.lastTitle = result.lastTitle ?? '';
      this.isReadyToLoad = true;
      this.contentVisible = false;
      this.loadingState = 'success';
      this._setupContentsObserver();
      this._cdr.detectChanges();
    }).catch(() => {
      this.loadingState = 'failed';
      this._cdr.detectChanges();
    });
  }

  ctaLinkPath(url: string): string {
    return url.split('?')[0];
  }

  ctaLinkParams(url: string): Record<string, string> | null {
    const qs = url.split('?')[1];
    if (!qs) return null;
    return Object.fromEntries(new URLSearchParams(qs).entries());
  }

  ngOnDestroy() {
    this._teardownContentsObserver();
    this._routeSubs?.unsubscribe();
  }

  private _setupContentsObserver() {
    if (!this._isBrowser) {
      return;
    }

    this._teardownContentsObserver();

    if (!this.showContents) {
      this._hasSeenContentsInViewport = false;
      this.showFloatingBackToContents = false;
      return;
    }

    this._hasSeenContentsInViewport = false;

    // Wait for deferred template flush so the contents anchor is present in the DOM.
    requestAnimationFrame(() => {
      const contentsEl = document.getElementById('contents');
      if (!contentsEl) {
        this._contentsObserverRetryTimer = window.setTimeout(() => {
          this._setupContentsObserver();
        }, 180);
        return;
      }

      this._contentsObserver = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) {
            this._hasSeenContentsInViewport = true;
            this.showFloatingBackToContents = false;
          } else {
            const isBelowContents = entry.boundingClientRect.top < 0;
            this.showFloatingBackToContents = this._hasSeenContentsInViewport && isBelowContents;
          }
          this._cdr.detectChanges();
        },
        {
          root: null,
          threshold: 0,
        }
      );

      this._contentsObserver.observe(contentsEl);
    });
  }

  private _teardownContentsObserver() {
    this._contentsObserver?.disconnect();
    this._contentsObserver = undefined;
    if (this._contentsObserverRetryTimer !== undefined) {
      clearTimeout(this._contentsObserverRetryTimer);
      this._contentsObserverRetryTimer = undefined;
    }
  }

  async onLike() {
    if (this.hasLiked) return;
    try {
      const res = await this._http.likePost(this.post.slug);
      this.likeCount = res.likes;
      this.hasLiked = true;
      this._saveLikeToStorage(this.post.slug);
      this._cdr.detectChanges();
    } catch {
      // Silently fail — don't break the page for a like
    }
  }

  private _hasLikedInStorage(slug: string): boolean {
    try {
      const liked: string[] = JSON.parse(localStorage.getItem('sn_liked_posts') || '[]');
      return liked.includes(slug);
    } catch { return false; }
  }

  private _saveLikeToStorage(slug: string) {
    try {
      const liked: string[] = JSON.parse(localStorage.getItem('sn_liked_posts') || '[]');
      if (!liked.includes(slug)) {
        liked.push(slug);
        localStorage.setItem('sn_liked_posts', JSON.stringify(liked));
      }
    } catch { /* ignore */ }
  }
}
