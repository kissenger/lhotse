import { Component, Inject, OnDestroy, OnInit } from '@angular/core';
import { BlogEditorComponent } from '@pages/blog/editor/blog-editor.component';
import { HttpService } from '@shared/services/http.service';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { BlogPost } from '@shared/types';
import { DOCUMENT, NgOptimizedImage } from '@angular/common';
import { SEOService } from '@shared/services/seo.service';
import { KebaberPipe } from '@shared/pipes/kebaber.pipe';
import { BlogSanitizerPipe } from '@shared/pipes/blog-sanitizer.pipe';
import { BannerAdComponent } from '@shared/components/banner-ad/banner-ad.component';

@Component({
  selector: 'app-post-shower',
  standalone: true,
  providers: [],
  templateUrl: './post-shower.component.html',
  styleUrl: './post-shower.component.css',
  imports: [NgOptimizedImage, BlogEditorComponent, RouterLink, 
    KebaberPipe, BlogSanitizerPipe, BannerAdComponent]
})
export class PostShowerComponent implements OnDestroy, OnInit {
  public post: BlogPost = new BlogPost;
  public isReadyToLoad: boolean = false;
  private _httpSubs: Subscription | undefined;  
  

  constructor(
    @Inject(DOCUMENT) private dom: any,
    private _http: HttpService,
    private _route: ActivatedRoute,
    private _seo: SEOService   
  ) {

  }

  async ngOnInit() {
    this._route.params.subscribe(params => {
      this._httpSubs = this._http.getPostBySlug(params['slug']).subscribe({
        next: (result) => {
          this.post = result;
          this.isReadyToLoad = true;
          this._seo.updateCanonincalUrl(this._route.snapshot.url.join('/'));
          this._seo.updateTitle(this.post.title);
          this._seo.updateKeywords(this.post.keywords.join(', '));
          this._seo.updateDescription(`A blog post authored by Snorkelogy. ${this.post.subtitle}`);
        },
        error: (error) => {
          console.log(error);
        }
      }) 
    });

  }

  // updateTitle() {
  //   this._title.setTitle(environment.STAGE === 'prod' ? this.post.title : environment.STAGE + ' - ' + this.post.title);
  // }

  // updateKeywords() {
  //   let nkw = this.post.keywords.join(', ');
  //   if (nkw) {
  //     let kw = this._meta.getTag('name=keywords');
  //     if (kw) {
  //       nkw = kw.content + ', ' + nkw
  //     }
  //     this._meta.updateTag({name: 'keywords', content: nkw});
  //   }
  // }
  // // source: https://www.tektutorialshub.com/angular/angular-canonical-url/
  // updateCanonicalUrl(){
  //   let canonicalUrl = 'https://snorkelology.com/' + this._route.snapshot.url.join('/');
  //   console.log(canonicalUrl);
  //   const head = this.dom.getElementsByTagName('head')[0];
  //   var element: HTMLLinkElement= this.dom.querySelector(`link[rel='canonical']`) || null
  //   if (element==null) {
  //     element= this.dom.createElement('link') as HTMLLinkElement;
  //     head.appendChild(element);
  //   }
  //   element.setAttribute('rel','canonical')
  //   element.setAttribute('href', canonicalUrl)
  // }

  ngOnDestroy() {
    this._httpSubs?.unsubscribe();
  }

}