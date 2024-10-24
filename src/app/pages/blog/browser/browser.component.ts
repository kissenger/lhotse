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

@Component({
  selector: 'app-blog-browser',
  standalone: true,
  providers: [],
  template: `
      <div class="browser-container">
        <div #browser class="browser dynamic-container">
          @for (post of posts; track posts) {
            <app-blog-card [data]="post"></app-blog-card>
          }
        </div>
        <div #leftArrow>
          <app-svg-arrow direction="left" (click)="onClickLeft()"></app-svg-arrow>
        </div>
        <div #rightArrow>        
          <app-svg-arrow direction="right" (click)="onClickRight()"></app-svg-arrow>
        </div>
      </div>

  `,
  styleUrl: './browser.component.css',
  imports: [ BlogCardComponent, SvgArrowComponent, CommonModule ]
})
export class BlogBrowserComponent implements OnInit, OnDestroy {

  @ViewChild('browser') browser!: ElementRef;
  @ViewChild('leftArrow') leftArrow!: ElementRef;
  @ViewChild('rightArrow') rightArrow!: ElementRef;

  private _httpSubs: Subscription | undefined;  
  public posts: Array<BlogPost> = [];
  public hideLeftArrow: boolean = false;
  public hideRightArrow: boolean = false;

  constructor(
    private _http: HttpService,
    private _route: ActivatedRoute,
    private _screen: ScreenService,
    private _data: DataService
  ) {}

  async ngOnInit() {

    this._route.params.subscribe( () => {
      this._httpSubs = this._http.getPublishedPosts().subscribe({
        next: (result) => {
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
    this.browser.nativeElement.addEventListener("scrollend", (event: any) => {
      const maxScrollPosition = this.browser.nativeElement.scrollWidth - this._screen.width - 18;
      const scrollPosition = this.browser.nativeElement.scrollLeft;
      this.leftArrow.nativeElement.style.pointerEvents = "auto"
      this.rightArrow.nativeElement.style.pointerEvents = "auto"
      if (scrollPosition > 0.9*maxScrollPosition) {
        this.rightArrow.nativeElement.style.pointerEvents = "none"
      } else if (scrollPosition === 0) {
        this.leftArrow.nativeElement.style.pointerEvents = "none"
      }
    });
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