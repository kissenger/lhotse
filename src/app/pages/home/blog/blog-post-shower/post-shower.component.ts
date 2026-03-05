import { ChangeDetectorRef, Component, Inject, OnDestroy, OnInit, PLATFORM_ID } from '@angular/core';
import { HttpService } from '@shared/services/http.service';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Subscription, switchMap } from 'rxjs';
import { BlogPost } from '@shared/types';
import { CommonModule, NgOptimizedImage } from '@angular/common';
import { SEOService } from '@shared/services/seo.service';
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
    private _seo: SEOService,
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

        this._seo.updateCanonicalUrl(this._route.snapshot.url.join('/') ?? '');
        this._seo.updateTitle(this.post.title ?? '');
        this._seo.updateKeywords((this.post.keywords ?? []).join(', '));
        const description = `A blog post from the authors of Snorkelling Britain - ${this.post.subtitle ?? ''}`;
        this._seo.updateDescription(description);
        // social meta: use the post image if we have one
        const imageUrl = this.post.imgFname ?
            `https://snorkelology.co.uk/assets/${this.post.imgFname}` :
            'https://snorkelology.co.uk/banner/snround.webp';
        this._seo.updateOpenGraph({
          type: 'article',
          image: imageUrl
        });
        this._seo.updateTwitterCard({
          card: 'summary_large_image',
          image: imageUrl,
          site: '@snorkelology'
        });
        let entity: string;
        if (this.post.type === 'faq') {
          entity = this.makeFaqEntity();
        } else {
          entity = this.makeArticleEntity();
        }
        this._seo.addStructuredData(entity);
        this.isReadyToLoad = true;
        this._cdr.detectChanges();
      });
  }

  makeArticleEntity(): string {
    return JSON.stringify({
      '@context': 'https://schema.org/',
      '@type': 'Blog',
      '@id': 'https://snorkelology.co.uk/',
      'mainEntityOfPage': 'https://snorkelology.co.uk/',
      'name': 'Snorkelology Blog',
      'description': 'A blog post from the authors of Snorkelling Britain',
      'publisher': {
        '@context': 'http://schema.org',
        '@type': 'Organization',
        'name': 'Snorkelology',
        'url': 'https://snorkelology.co.uk',
        'logo': 'https://snorkelology.co.uk/banner/snround.webp',
        'description': 'Snorkelology is a website from the authors of Snorkelling Britain - explore our website for snorkelling sites, snorkelling gear recommendations and inspiring underwater photography.',
        'sameAs': [
          'https://instagram.com/snorkelology',
          'https://www.youtube.com/@snorkelology',
          'https://www.facebook.com/snorkelology'
        ]
      },
      'blogPost': [{
        '@type': 'BlogPosting',
        '@id': `https://snorkelology.co.uk/blog/${this.post.slug}`,
        'mainEntityOfPage': `https://snorkelology.co.uk/blog/${this.post.slug}`,
        'headline': this.post.title,
        'name': this.post.title,
        'datePublished': this.post.createdAt,
        'dateModified': this.post.updatedAt,
        'description': `A blog post from the authors of Snorkelling Britain - ${this.post.subtitle}`,
        'author': {
          '@type': 'organization',
          '@id': 'https://snorkelology.co.uk',
          'name': 'Snorkelology'
        },
        'image': {
          '@type': 'ImageObject',
          '@id': `https://snorkelology.co.uk/assets/${this.post.imgFname}`,
          'url': `https://snorkelology.co.uk/assets/${this.post.imgFname}`
        },
        'url': `https://snorkelology.co.uk/blog/${this.post.slug}`
      }]
    });
  }

  makeFaqEntity(): string {
    const entity = (this.post.sections ?? []).map((q: any) => ({
      '@type': 'Question',
      'name': q.title,
      'acceptedAnswer': {
        '@type': 'Answer',
        'text': q.content.replace(/"/g, '\''),
        'datePublished': this.post.createdAt,
        'dateModified': this.post.updatedAt
      }
    }));
    return JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      'mainEntity': entity
    });
  }

  ngOnDestroy() {
    this._routeSubs?.unsubscribe();
  }
}
