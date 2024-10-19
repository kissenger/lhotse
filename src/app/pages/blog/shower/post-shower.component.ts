import { Component, OnDestroy, OnInit } from '@angular/core';
import { BlogEditorComponent } from '@pages/blog/editor/blog-editor.component';
import { HttpService } from '@shared/services/http.service';
import { ActivatedRoute } from '@angular/router';
import { Subscription } from 'rxjs';
import { BlogPost } from '@shared/types';
import { NavService } from '@shared/services/nav.service';
import { BlogSanitizerComponent } from "@pages/blog/shower/blog-sanitizer/blog-sanitizer.component";
import { NgOptimizedImage, provideImgixLoader } from '@angular/common';
import { environment } from '@environments/environment';

@Component({
  selector: 'app-post-shower',
  standalone: true,
  providers: provideImgixLoader(`https://${environment.IMGIX_DOMAIN}`),
  templateUrl: './post-shower.component.html',
  styleUrl: './post-shower.component.css',
  imports: [NgOptimizedImage, BlogEditorComponent, BlogSanitizerComponent]
})
export class PostShowerComponent implements OnDestroy, OnInit {
  public post: BlogPost = new BlogPost;
  public isReadyToLoad: boolean = false;
  private _httpSubs: Subscription | undefined;  
  

  constructor(
    private _http: HttpService,
    private _route: ActivatedRoute,
    public navigate: NavService
  ) {}

  async ngOnInit() {
    this._route.params.subscribe(params => {
      this._httpSubs = this._http.getPostBySlug(params['slug']).subscribe({
        next: (result) => {
          this.post = result;
          this.isReadyToLoad = true;
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