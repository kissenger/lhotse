import { AfterViewInit, Component, ElementRef, Inject, OnDestroy, OnInit, PLATFORM_ID, QueryList, ViewChildren } from '@angular/core';
import { BlogEditorComponent } from '@pages/blog/editor/blog-editor.component';
import { HttpService } from '@shared/services/http.service';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { BlogPost } from '@shared/types';
import { DOCUMENT, isPlatformBrowser, NgOptimizedImage } from '@angular/common';
import { SEOService } from '@shared/services/seo.service';
import { KebaberPipe } from '@shared/pipes/kebaber.pipe';
import { BlogSanitizerPipe } from '@shared/pipes/blog-sanitizer.pipe';
import { BannerAdComponent } from '@shared/components/banner-ad/banner-ad.component';

@Component({
  selector: 'app-post-shower',
  standalone: true,
  providers: [BlogSanitizerPipe],
  templateUrl: './post-shower.component.html',
  styleUrl: './post-shower.component.css',
  imports: [NgOptimizedImage, BlogEditorComponent, RouterLink, 
    KebaberPipe, BlogSanitizerPipe, BannerAdComponent]
})
export class PostShowerComponent implements OnDestroy, OnInit, AfterViewInit {
  public post: BlogPost = new BlogPost;
  public isReadyToLoad: boolean = false;
  private _httpSubs: Subscription | undefined;  
  @ViewChildren('qanda') questions!: QueryList<any>;
  // @ViewChildren('answer') answers!: QueryList<any>;


  constructor(
    @Inject(PLATFORM_ID) private platformId: any,
    @Inject(DOCUMENT) private dom: any,
    private _http: HttpService,
    private _route: ActivatedRoute,
    private _seo: SEOService
  ) {

  }

  ngAfterViewInit() {

    this.questions.changes.subscribe((qs) => {

      const entity = qs.map( (q:any) => { return `{
        "@type": "Question",
        "name": "${q.nativeElement.children[0].innerText}",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "${q.nativeElement.children[1].innerText.split("\n")[0]}"}}`
            }).join(",");

      this._seo.addStructuredData(`
        {
          "@context": "https://schema.org",
          "@type": "FAQPage",
          "mainEntity": [${entity}]
        }
      `);

    });


    
  }

  async ngOnInit() {
    // console.log(this.questions);
    this._route.params.subscribe(params => {
      // this is a hack to avoid an error 
      if (!params['slug'].match('map')) {
        this._httpSubs = this._http.getPostBySlug(params['slug']).subscribe({
          next: (result) => {
            this.post = result;
            this.isReadyToLoad = true;
            this._seo.updateCanonincalUrl(this._route.snapshot.url.join('/'));
            this._seo.updateTitle(this.post.title);
            this._seo.updateKeywords(this.post.keywords.join(', '));
            this._seo.updateDescription(`A blog post authored by Snorkelogy. ${this.post.subtitle}`);
            this._seo.addStructuredData(`
              {
                "@context": "https://schema.org",
                "@type": "FAQPage",
                "mainEntity": ["bums"]
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
  }

}