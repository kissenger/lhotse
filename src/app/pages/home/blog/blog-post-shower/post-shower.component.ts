import { ChangeDetectorRef, Component, Inject, OnDestroy, OnInit, PLATFORM_ID } from '@angular/core';
import { HttpService } from '@shared/services/http.service';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Subscription, switchMap } from 'rxjs';
import { BlogPost } from '@shared/types';
import { CommonModule, NgOptimizedImage } from '@angular/common';
import { KebaberPipe } from '@shared/pipes/kebaber.pipe';
import { HtmlerPipe } from '@shared/pipes/htmler.pipe';
import { SanitizerPipe } from '@shared/pipes/sanitizer.pipe';
import { SvgArrowComponent } from '@shared/components/svg-arrow/svg-arrow.component';
import { stage } from '@shared/globals';
import { DomSanitizer } from '@angular/platform-browser';

@Component({
  selector: 'app-post-shower',
  standalone: true,
  providers: [HtmlerPipe, SanitizerPipe],
  templateUrl: './post-shower.component.html',
  styleUrl: './post-shower.component.css',
  imports: [SvgArrowComponent, KebaberPipe, SanitizerPipe, CommonModule, RouterLink, NgOptimizedImage]
})

export class PostShowerComponent implements OnDestroy, OnInit {
  post: BlogPost;
  isReadyToLoad: boolean;
  nextSlug: string;
  lastSlug: string = '';
  stage: any = stage;
  private _routeSubs: Subscription | undefined;

  constructor(
    private _http: HttpService,
    @Inject(PLATFORM_ID) private platformId: any,
    private _route: ActivatedRoute,
    private _htmler: HtmlerPipe,
    private _router: Router,
    private sanitizer: DomSanitizer,
    private _cdr: ChangeDetectorRef
  ) {
    this.post = new BlogPost();
    this.isReadyToLoad = false;
    this.nextSlug = '';
    this.lastSlug = '';
    this.stage = stage;
  }

  ngOnInit() {
    this._routeSubs = this._route.params
      .pipe(
        switchMap((params: { [key: string]: string }) => this._http.getPostBySlug(params['slug']))
      )
      .subscribe((result: any) => {
        console.log(result);
        if (!result || !result.article) return;
        this.post = result.article;
        console.log(this.post);
        this.post.intro = this._htmler.transform(result.article.intro ?? '');
        console.log(this.post.intro);
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
        this._cdr.detectChanges();
      });
  }

  ngOnDestroy() {
    this._routeSubs?.unsubscribe();
  }
}
