import { Component, OnDestroy, OnInit } from '@angular/core';
import { BlogEditorComponent } from '@pages/blog/editor/blog-editor.component';
import { HttpService } from '@shared/services/http.service';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { BlogPost } from '@shared/types';
import { NgOptimizedImage } from '@angular/common';
import { SEOService } from '@shared/services/seo.service';
import { KebaberPipe } from '@shared/pipes/kebaber.pipe';
import { HtmlerPipe } from '@shared/pipes/htmler.pipe';
import { SanitizerPipe } from '@shared/pipes/sanitizer.pipe';
import { BannerAdComponent } from '@shared/components/banner-ad/banner-ad.component';

@Component({
  selector: 'app-post-shower',
  standalone: true,
  providers: [HtmlerPipe, SanitizerPipe],
  templateUrl: './post-shower.component.html',
  styleUrl: './post-shower.component.css',
  imports: [NgOptimizedImage, BlogEditorComponent, RouterLink, 
    KebaberPipe, HtmlerPipe, SanitizerPipe, BannerAdComponent]
})
export class PostShowerComponent implements OnDestroy, OnInit {
  public post: BlogPost = new BlogPost;
  public isReadyToLoad: boolean = false;
  private _httpSubs: Subscription | undefined;  
  private _routeSubs: Subscription | undefined;  

  constructor(
    private _http: HttpService,
    private _route: ActivatedRoute,
    private _seo: SEOService,
    private _htmler: HtmlerPipe
  ) {

  }

  async ngOnInit() {
    // console.log(this.questions);
    this._routeSubs = this._route.params.subscribe(params => {

      // this is a hack to avoid an error 
      if (!params['slug'].match('map')) {
        this._httpSubs = this._http.getPostBySlug(params['slug']).subscribe({
          next: (result) => {

            // htmlize blog entries to avoid doing it twice
            this.post = result
            console.log(result);
            this.post.intro = this._htmler.transform(result.intro);
            this.post.conclusion = this._htmler.transform(result.conclusion);
            this.post.sections = result.sections.map( s => { return {
              title: s.title, 
              content: this._htmler.transform(s.content), 
              imgFname: s.imgFname,
              imgAlt: s.imgAlt
            }})

            this.isReadyToLoad = true;

            this._seo.updateCanonincalUrl(this._route.snapshot.url.join('/'));
            this._seo.updateTitle(this.post.title);
            this._seo.updateKeywords(this.post.keywords.join(', '));
            this._seo.updateDescription(`A blog post authored by Snorkelogy. ${this.post.subtitle}`);

            let entity: string;
            if (this.post.type === 'faq') {
              entity = this.makeFaqEntity();
            } else {
              entity = this.makeArticleEntity();
            }
            this._seo.addStructuredData(entity);

        },
        error: (error) => {
          console.log(error);
        }
      }) 
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
      "description": "Snorkelology blog covering topics related to snorkelling around Britain",
      "publisher": {
        "@context": "http://schema.org",
        "@type": "Organization",
        "name": "Snorkelology",
        "url": "https://snorkelology.co.uk",
        "logo": "https://snorkelology.co.uk/banner/snround.webp",
        "description": "Snorkelology is a website dedicated to snorkelling in Britain. Explore rich blog posts detailing the wonderful British marine environment, view inspiring underwater photography, and learn about our forecoming book: Snorkelling Britain.",
        "sameAs": "https://instagram.com/snorkelology"},
      "blogPost": [{
        "@type": "BlogPosting",
        "@id": "https://snorkelology.co.uk/blog/${this.post.slug}",
        "mainEntityOfPage": "https://snorkelology.co.uk/blog/${this.post.slug}",
        "headline": "${this.post.title}",
        "name": "${this.post.title}",
        "description": "A blog post authored by Snorkelogy. ${this.post.subtitle}",
        "author": {
          "@type": "organization",
          "@id": "https://snorkelology.co.uk",
          "name": "Snorkelology" },
        "image": {
          "@type": "ImageObject",
          "@id": "https://snorkelology.co.uk/assets/${this.post.imgFname}",
          "url": "https://snorkelology.co.uk/assets/${this.post.imgFname}" },
        "url": "https://snorkelology.co.uk/blog/${this.post.slug}"
        }
        `
  }

  makeFaqEntity(): string {

    const entity = this.post.sections.map( (q:any) => { return `{
      "@type": "Question",
      "name": "${q.title}",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "${q.content.replaceAll('\"','\'')}"}}`
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
    this._httpSubs?.unsubscribe();
    this._routeSubs?.unsubscribe();
  }

}
