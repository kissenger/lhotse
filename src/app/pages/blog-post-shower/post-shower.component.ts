import { Component, Inject, OnDestroy, OnInit, PLATFORM_ID } from '@angular/core';
import { HttpService } from '@shared/services/http.service';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { BlogPost } from '@shared/types';
import { CommonModule, NgOptimizedImage } from '@angular/common';
import { SEOService } from '@shared/services/seo.service';
import { KebaberPipe } from '@shared/pipes/kebaber.pipe';
import { HtmlerPipe } from '@shared/pipes/htmler.pipe';
import { SanitizerPipe } from '@shared/pipes/sanitizer.pipe';
import { SvgArrowComponent } from '@shared/components/svg-arrow/svg-arrow.component';
import { stage } from '@shared/globals';
import { DomSanitizer } from '@angular/platform-browser';
// import { Router } from 'express';

@Component({
  selector: 'app-post-shower',
  standalone: true,
  providers: [HtmlerPipe, SanitizerPipe],
  templateUrl: './post-shower.component.html',
  styleUrl: './post-shower.component.css',
  imports: [SvgArrowComponent, KebaberPipe, SanitizerPipe, CommonModule, RouterLink, NgOptimizedImage]
})
export class PostShowerComponent implements OnDestroy, OnInit {
  public post: BlogPost = new BlogPost;
  public isReadyToLoad: boolean = false;
  public nextSlug: string = '';
  public lastSlug: string = '';
  public stage = stage;
  private _routeSubs: Subscription | undefined;  

  constructor(
    private _http: HttpService,
    @Inject(PLATFORM_ID) private platformId: any,
    @Inject(ActivatedRoute) private _route: ActivatedRoute,
    private _seo: SEOService,
    private _htmler: HtmlerPipe,
    @Inject(Router) private _router: Router,
    private sanitizer: DomSanitizer
  ) {

  }

  ngOnInit() {
    // console.log(this.stage)
    this._routeSubs = this._route.params.subscribe(async params => {

        // this is a hack to avoid an error 
      if (!params['slug'].match('map')) {

        const result = await this._http.getPostBySlug(params['slug']);

        this.post = result.article;
        this.post.intro = this._htmler.transform(result.article.intro);
        this.post.conclusion = this._htmler.transform(result.article.conclusion);
        this.post.sections = result.article.sections.map( (s: any) => { return {
          title: s.title, 
          content: this._htmler.transform(s.content), 
          imgFname: s.imgFname,
          imgAlt: s.imgAlt,
          videoUrl: this.sanitizer.bypassSecurityTrustResourceUrl(`https://www.youtube.com/embed/${s.videoUrl}?controls=0&mute=1&autoplay=1&loop=1&playlist=${s.videoUrl}`)
          // videoUrl: s.videoUrl
        }})

        console.log(this.post.sections)

        this.nextSlug = result.nextSlug;
        this.lastSlug = result.lastSlug;

        this._seo.updateCanonincalUrl(this._route.snapshot.url.join('/'));
        this._seo.updateTitle(this.post.title);
        this._seo.updateKeywords(this.post.keywords.join(', '));
        this._seo.updateDescription(`A blog post from the authors of Snorkelling Britain - ${this.post.subtitle}`);

        let entity: string;
        if (this.post.type === 'faq') {
          entity = this.makeFaqEntity();
        } else {
          entity = this.makeArticleEntity();
        }
        this._seo.addStructuredData(entity);
        
        this.isReadyToLoad = true;
      }
    });
  }

  makeArticleEntity(): string {

    return `
    {
      "@context": "https://schema.org/",
      "@type": "Blog",
      "@id": "https://snorkelology.co.uk/",
      "mainEntityOfPage": "https://snorkelology.co.uk/",
      "name": "Snorkelology Blog",
      "description": "A blog post from the authors of Snorkelling Britain",
      "publisher": {
        "@context": "http://schema.org",
        "@type": "Organization",
        "name": "Snorkelology",
        "url": "https://snorkelology.co.uk",
        "logo": "https://snorkelology.co.uk/banner/snround.webp",
        "description": "Snorkelology is a website from the authors of Snorkelling Britain - explore our website for snorkelling sites, snorkelling gear recommendations and inspiring underwater photography.",
        "sameAs": [
          "https://instagram.com/snorkelology",
          "https://www.youtube.com/@snorkelology", 
          "https://www.facebook.com/snorkelology"
        ]},
      "blogPost": [{
        "@type": "BlogPosting",
        "@id": "https://snorkelology.co.uk/blog/${this.post.slug}",
        "mainEntityOfPage": "https://snorkelology.co.uk/blog/${this.post.slug}",
        "headline": "${this.post.title}",
        "name": "${this.post.title}",
        "datePublished": "${this.post.createdAt}",
        "dateModified": "${this.post.updatedAt}",
        "description": "A blog post from the authors of Snorkelling Britain - ${this.post.subtitle}",
        "author": {
          "@type": "organization",
          "@id": "https://snorkelology.co.uk",
          "name": "Snorkelology" },
        "image": {
          "@type": "ImageObject",
          "@id": "https://snorkelology.co.uk/assets/${this.post.imgFname}",
          "url": "https://snorkelology.co.uk/assets/${this.post.imgFname}" },
        "url": "https://snorkelology.co.uk/blog/${this.post.slug}"
      }]
    }`
  }

  makeFaqEntity(): string {

    const entity = this.post.sections.map( (q:any) => { return `{
      "@type": "Question",
      "name": "${q.title}",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "${q.content.replaceAll('\"','\'')}",
        "datePublished": "${this.post.createdAt}",
        "dateModified": "${this.post.updatedAt}"
        }
      }`
        
    }).join(",");

    return `
      {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        "mainEntity": [${entity}]
      }
    `
  }

  ngOnDestroy() {
    this._routeSubs?.unsubscribe();
  }

}
