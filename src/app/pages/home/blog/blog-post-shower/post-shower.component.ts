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

  ngOnInit() {
    if (!isPlatformBrowser(this._platformId)) return;
    this._routeSubs = this._route.params
      .pipe(
        switchMap(async (params: { [key: string]: string }) => {
          const slug = params['slug'];
          const [postResult, slugResult] = await Promise.race([
            Promise.all([
              this._http.getPostBySlug(slug),
              this._http.getLastAndNextSlugs(slug)
            ]),
            new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), 15000))
          ]);

          return {
            ...postResult,
            ...slugResult
          };
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
          this.contentVisible = false;
          this.loadingState = 'success';
          const updatedMonth: Date = new Date(this.post.updatedAt);
          const createdMonth: Date = new Date(this.post.createdAt);
          if (updatedMonth > new Date(createdMonth.setMonth(createdMonth.getMonth()+1)) ) {
            this.showUpdatedAt = true;
          }
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
  }

  onRetry() {
    this.loadingState = 'loading';
    this.isReadyToLoad = false;
    this.contentVisible = false;
    const slug = this._route.snapshot.params['slug'];
    Promise.race([
      Promise.all([
        this._http.getPostBySlug(slug),
        this._http.getLastAndNextSlugs(slug)
      ]),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), 15000))
    ]).then(([postResult, slugResult]) => {
      const result = { ...postResult, ...slugResult } as any;
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
}
