import { Component, OnDestroy, OnInit } from '@angular/core';
import { BlogEditorComponent } from '../editor/blog-editor.component';
import { HttpService } from '@shared/services/http.service';
import { ActivatedRoute } from '@angular/router';
import { Subscription } from 'rxjs';
import { BlogPost } from '@shared/types';
import { BlogSanitizerComponent } from "@pages/blog/shower/blog-sanitizer/blog-sanitizer.component";
import { NgOptimizedImage, provideImgixLoader } from '@angular/common';
import { environment } from '@environments/environment';
import { BlogCardComponent } from '@pages/blog/browser/blog-card/blog-card.component';

@Component({
  selector: 'app-blog-browser',
  standalone: true,
  providers: provideImgixLoader(`https://${environment.IMGIX_DOMAIN}`),
  template: `
    <div class="dynamic-container">
      <div class="blog-grid">
          @for (post of posts; track posts) {
              <app-blog-card
                  [data]="post"
              ></app-blog-card>
          }
      </div>
    </div>`,
  styleUrl: './browser.component.css',
  imports: [NgOptimizedImage, BlogEditorComponent, BlogSanitizerComponent, BlogCardComponent]
})
export class BlogBrowserComponent implements OnInit, OnDestroy {
  
  private _httpSubs: Subscription | undefined;  
  public posts: Array<BlogPost> = [];

  constructor(
    private _http: HttpService,
    private _route: ActivatedRoute,
  ) {
  }

  async ngOnInit() {

    this._route.params.subscribe(params => {
      this._httpSubs = this._http.getPublishedPosts().subscribe({
        next: (result) => {
          this.posts = result;
          console.log(this.posts);
        },
        error: (error) => {
          console.log(error);
        }
      }) 
    });
    
  }

  ngOnDestroy() {
    this._httpSubs?.unsubscribe();
  }

}