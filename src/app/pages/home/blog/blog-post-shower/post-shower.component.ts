import { ChangeDetectorRef, Component, Inject, OnDestroy, OnInit, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpService } from '@shared/services/http.service';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Subscription, switchMap } from 'rxjs';
import { BlogPost } from '@shared/types';
import { CommonModule, NgOptimizedImage } from '@angular/common';
import { KebaberPipe } from '@shared/pipes/kebaber.pipe';
import { HtmlerPipe } from '@shared/pipes/htmler.pipe';
import { SanitizerPipe } from '@shared/pipes/sanitizer.pipe';
import { SvgArrowComponent } from '@shared/components/svg-arrow/svg-arrow.component';
import { LoaderComponent } from '@shared/components/loader/loader.component';
import { stage } from '@shared/globals';
import { DomSanitizer } from '@angular/platform-browser';

@Component({
  selector: 'app-post-shower',
  standalone: true,
  providers: [HtmlerPipe, SanitizerPipe],
  templateUrl: './post-shower.component.html',
  styleUrl: './post-shower.component.css',
  imports: [SvgArrowComponent, KebaberPipe, SanitizerPipe, CommonModule, RouterLink, NgOptimizedImage, LoaderComponent]
})

export class PostShowerComponent implements OnDestroy, OnInit {
  post: BlogPost;
  isReadyToLoad: boolean;
  contentVisible: boolean;
  loadingState: 'loading' | 'failed' | 'success' = 'loading';
  nextSlug: string;
  lastSlug: string = '';
  stage: any = stage;
  showUpdatedAt: boolean = false;
  likeCount: number = 0;
  hasLiked: boolean = false;
  isPreview: boolean = false;
  private _routeSubs: Subscription | undefined;

  constructor(
    private _http: HttpService,
    @Inject(PLATFORM_ID) private _platformId: any,
    private _route: ActivatedRoute,
    private _htmler: HtmlerPipe,
    private _router: Router,
    private sanitizer: DomSanitizer,
    private _cdr: ChangeDetectorRef
  ) {
    this.post = new BlogPost();
    this.isReadyToLoad = false;
    this.contentVisible = false;
    this.nextSlug = '';
    this.lastSlug = '';
    this.stage = stage;
  }

  private async _fetchPost(slug: string): Promise<any> {
    if (this.isPreview) {
      const postResult = await Promise.race([
        this._http.getPostBySlug(slug),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), 15000))
      ]);
      return { ...postResult, nextSlug: '', lastSlug: '' };
    }
    const [postResult, slugResult] = await Promise.race([
      Promise.all([
        this._http.getPostBySlug(slug),
        this._http.getLastAndNextSlugs(slug)
      ]),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), 15000))
    ]);
    return { ...postResult, ...slugResult };
  }

  ngOnInit() {
    if (!isPlatformBrowser(this._platformId)) return;
    this.isPreview = this._route.snapshot.queryParamMap.has('preview');
    this._routeSubs = this._route.params
      .pipe(
        switchMap(async (params: { [key: string]: string }) => {
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
          this.post.intro = this._htmler.transform(result.article.intro ?? '');
          this.post.conclusion = this._htmler.transform(result.article.conclusion ?? '');
          this.post.sections = (result.article.sections ?? []).map((s: any) => ({
            title: s.title ?? '',
            content: this._htmler.transform(s.content ?? ''),
            imgFname: s.imgFname ?? '',
            imgAlt: s.imgAlt ?? '',
            imgCredit: s.imgCredit ?? '',
            videoUrl: !!s.videoUrl ? this.sanitizer.bypassSecurityTrustResourceUrl(`https://www.youtube-nocookie.com/embed/${s.videoUrl}?controls=0&mute=1&autoplay=1&loop=1&playlist=${s.videoUrl}`) : ''
          }));
          this.nextSlug = result.nextSlug ?? '';
          this.lastSlug = result.lastSlug ?? '';
          this.isReadyToLoad = true;
          this.contentVisible = (this.isPreview && !this.post.imgFname);
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
      this.post.intro = this._htmler.transform(result.article.intro ?? '');
      this.post.conclusion = this._htmler.transform(result.article.conclusion ?? '');
      this.post.sections = (result.article.sections ?? []).map((s: any) => ({
        title: s.title ?? '',
        content: this._htmler.transform(s.content ?? ''),
        imgFname: s.imgFname ?? '',
        imgAlt: s.imgAlt ?? '',
        imgCredit: s.imgCredit ?? '',
        videoUrl: !!s.videoUrl ? this.sanitizer.bypassSecurityTrustResourceUrl(`https://www.youtube-nocookie.com/embed/${s.videoUrl}?controls=0&mute=1&autoplay=1&loop=1&playlist=${s.videoUrl}`) : ''
      }));
      this.nextSlug = result.nextSlug ?? '';
      this.lastSlug = result.lastSlug ?? '';
      this.isReadyToLoad = true;
      this.contentVisible = false;
      this.loadingState = 'success';
      this._cdr.detectChanges();
    }).catch(() => {
      this.loadingState = 'failed';
      this._cdr.detectChanges();
    });
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
