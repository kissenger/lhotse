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

            const entity = this.post.sections.map( (s:any) => { return `{
              "@type": "Question",
              "name": "${s.title}",
              "acceptedAnswer": {
                "@type": "Answer",
                "text": "${s.content.replaceAll('\"','\'')}"}}`
            }).join(",");

            this._seo.addStructuredData(`
              {
                "@context": "https://schema.org",
                "@type": "FAQPage",
                "mainEntity": [${entity}]
              }
            `);

        },
        error: (error) => {
          console.log(error);
        }
      }) 
    }
    });

  }

  ngOnDestroy() {
    this._httpSubs?.unsubscribe();
    this._routeSubs?.unsubscribe();
  }

}
