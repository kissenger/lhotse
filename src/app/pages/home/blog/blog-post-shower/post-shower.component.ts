import { ChangeDetectorRef, Component, Inject, OnDestroy, OnInit, PLATFORM_ID } from '@angular/core';
import { HttpService } from '@shared/services/http.service';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Subscription, combineLatest, switchMap, tap } from 'rxjs';
import { BlogPost } from '@shared/types';
import { CommonModule, NgOptimizedImage, isPlatformBrowser } from '@angular/common';
import { KebaberPipe } from '@shared/pipes/kebaber.pipe';
import { HtmlerPipe } from '@shared/pipes/htmler.pipe';
import { SanitizerPipe } from '@shared/pipes/sanitizer.pipe';
import { LoaderComponent } from '@shared/components/loader/loader.component';
import { stage } from '@shared/globals';
import { DomSanitizer } from '@angular/platform-browser';

@Component({
  selector: 'app-post-shower',
  standalone: true,
  providers: [HtmlerPipe, SanitizerPipe],
  templateUrl: './post-shower.component.html',
  styleUrl: './post-shower.component.css',
  imports: [KebaberPipe, SanitizerPipe, CommonModule, RouterLink, NgOptimizedImage, LoaderComponent]
})

export class PostShowerComponent implements OnDestroy, OnInit {
  post: BlogPost;
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
  private readonly _isBrowser: boolean;
  private _routeSubs: Subscription | undefined;

  constructor(
    private _http: HttpService,
    private _route: ActivatedRoute,
    private _htmler: HtmlerPipe,
    private _router: Router,
    private sanitizer: DomSanitizer,
    private _cdr: ChangeDetectorRef,
    @Inject(PLATFORM_ID) platformId: object
  ) {
    this.post = new BlogPost();
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

  private _extractYouTubeVideoId(value: string): string {
    const input = (value || '').trim();
    if (!input) return '';
    if (/^[a-zA-Z0-9_-]{11}$/.test(input)) return input;

    try {
      const url = new URL(input);
      const host = url.hostname.toLowerCase().replace(/^www\./, '');

      if (host === 'youtu.be') {
        const id = url.pathname.split('/').filter(Boolean)[0] || '';
        return /^[a-zA-Z0-9_-]{11}$/.test(id) ? id : '';
      }

      if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'youtube-nocookie.com') {
        if (url.pathname === '/watch') {
          const id = url.searchParams.get('v') || '';
          return /^[a-zA-Z0-9_-]{11}$/.test(id) ? id : '';
        }
        if (url.pathname.startsWith('/shorts/') || url.pathname.startsWith('/embed/')) {
          const id = url.pathname.split('/').filter(Boolean)[1] || '';
          return /^[a-zA-Z0-9_-]{11}$/.test(id) ? id : '';
        }
      }
    } catch {
      return '';
    }

    return '';
  }

  private _buildYouTubeEmbedUrl(value: string): string {
    const id = this._extractYouTubeVideoId(value);
    if (!id) return '';
    return `https://www.youtube-nocookie.com/embed/${id}?controls=0&mute=1&autoplay=1&loop=1&playlist=${id}`;
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

  get reviewStarsFilled(): number {
    const scale = this.post.review?.ratingScale || 5;
    const value = this.post.review?.ratingValue || 0;
    if (scale <= 0) return 0;
    return Math.max(0, Math.min(scale, Math.round(value)));
  }

  get reviewStarsEmpty(): number {
    const scale = this.post.review?.ratingScale || 5;
    return Math.max(0, scale - this.reviewStarsFilled);
  }

  get reviewStarsFilledArray(): number[] {
    return Array.from({ length: this.reviewStarsFilled }, (_, i) => i);
  }

  get reviewStarsEmptyArray(): number[] {
    return Array.from({ length: this.reviewStarsEmpty }, (_, i) => i);
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
    const defaults = new BlogPost().review;
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
    // Do not block SSR on API calls for blog body content; render quickly and hydrate on client.
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
            videoUrl: !!s.videoUrl ? this.sanitizer.bypassSecurityTrustResourceUrl(this._buildYouTubeEmbedUrl(s.videoUrl)) : '',
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
        videoUrl: !!s.videoUrl ? this.sanitizer.bypassSecurityTrustResourceUrl(this._buildYouTubeEmbedUrl(s.videoUrl)) : '',
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
    this._routeSubs?.unsubscribe();
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
