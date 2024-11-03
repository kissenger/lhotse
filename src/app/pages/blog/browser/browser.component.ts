import { Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { HttpService } from '@shared/services/http.service';
import { ActivatedRoute } from '@angular/router';
import { Subscription } from 'rxjs';
import { BlogPost } from '@shared/types';
import { BlogCardComponent } from '@pages/blog/browser/blog-card/blog-card.component';
import { ScreenService } from '@shared/services/screen.service';
import { SvgArrowComponent } from '@shared/components/svg-arrow/svg-arrow.component';
import { CommonModule } from '@angular/common';
import { DataService } from '@shared/services/data.service';
import { environment } from '@environments/environment';

@Component({
  selector: 'app-blog-browser',
  standalone: true,
  providers: [],
  templateUrl: './browser.component.html',
  styleUrl: './browser.component.css',
  imports: [ BlogCardComponent, SvgArrowComponent, CommonModule ]
})
export class BlogBrowserComponent implements OnInit, OnDestroy {

  @ViewChild('browser') browser!: ElementRef;
  @ViewChild('leftArrow') leftArrow!: ElementRef;
  @ViewChild('rightArrow') rightArrow!: ElementRef;

  private _httpSubs: Subscription | undefined;  
  public posts: Array<BlogPost> = [];

  constructor(
    private _http: HttpService,
    private _route: ActivatedRoute,
    private _screen: ScreenService,
    private _data: DataService,
  ) {}

  async ngOnInit() {

    this._route.params.subscribe( () => {
      const getFunction = environment.STAGE === 'prod' ? this._http.getPublishedPosts() : this._http.getAllPosts();
      this._httpSubs = getFunction.subscribe({
        next: (result) => {
          console.log(result);
          this.posts = result;
          this._data.isBlogDataEmitter.emit(this.posts.length !== 0);
        },
        error: (error) => {
          this._data.isBlogDataEmitter.emit(true);
          console.log(error);
        }
      }) 
    });
    
  }

  ngAfterViewInit() {

    // only position arrows if we are not on a mobile device...
    if ( matchMedia('(pointer:fine)').matches ) {

      // when mouse enters element, check croll position and redo this each time scroll ends
      this.browser.nativeElement.addEventListener("mouseenter", () => {
        this.checkArrows();
        this.browser.nativeElement.addEventListener("scrollend", this.checkArrows.bind(this));
      });

      // when mouse leves onlto an element that isnt an arrow, remove scroll event listener
      this.browser.nativeElement.addEventListener("mouseleave", (e: any) => {
        if (e.toElement.id !== "arrow") {
          this.leftArrow.nativeElement.style.opacity = "0";
          this.rightArrow.nativeElement.style.opacity = "0";
          this.browser.nativeElement.removeEventListener("scrollend", this.checkArrows);  
        }
      })
    } else {
      this.checkArrows();
      this.browser.nativeElement.addEventListener("scrollend", this.checkArrows.bind(this));
    }

  }

  checkArrows() {
    const scrollPosition = this.browser.nativeElement.scrollLeft;
    const maxScrollPosition = this.browser.nativeElement.scrollWidth - this._screen.width - 18;
    this.leftArrow.nativeElement.style.opacity = this.browser.nativeElement.scrollLeft !== 0 ? "1" : "0";
    this.rightArrow.nativeElement.style.opacity = scrollPosition < 0.9 * maxScrollPosition  ? "1" : "0";
  }

  public onClickLeft() {
    this.browser.nativeElement.scrollLeft -= this._screen.width * 0.9;
  }

  public async onClickRight() {
    this.browser.nativeElement.scrollLeft += this._screen.width * 0.9;  
  }

  ngOnDestroy() {
    this._httpSubs?.unsubscribe();
  }

}