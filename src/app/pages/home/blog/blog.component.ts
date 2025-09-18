import { Component, ElementRef, QueryList, ViewChild, ViewChildren } from '@angular/core';
import { HttpService } from '@shared/services/http.service';
import { ActivatedRoute } from '@angular/router';
import { BlogPost } from '@shared/types';
import { LoaderComponent } from '@shared/components/loader/loader.component';
import { BlogCardComponent } from './blog-card/blog-card.component';
import { ScreenService } from '@shared/services/screen.service';
import { SvgArrowComponent } from '@shared/components/svg-arrow/svg-arrow.component';
import { CommonModule, DOCUMENT } from '@angular/common';

@Component({
  standalone: true,
  imports: [ BlogCardComponent, SvgArrowComponent, CommonModule, LoaderComponent ],
  selector: 'app-blog',
  templateUrl: './blog.component.html',
  styleUrls: ['./blog.component.css'],
})

export class BlogComponent {
  @ViewChildren('browser') browser!: QueryList<ElementRef>;
  @ViewChildren('arrows') arrows!: QueryList<ElementRef>;

  public filteredPosts: Array<BlogPost> = [];
  public allPosts: Array<BlogPost> = [];
  public uniqueKeywords: Array<string> = [];
  public selectedKeywords: Array<string> = [];
  public loadingState: 'loading' | 'failed' | 'success' = 'loading';

  constructor(
    private _http: HttpService,
    private _route: ActivatedRoute,
    private _screen: ScreenService,
  ) {
  }

  async ngOnInit() {

    this._route.params.subscribe( async () => {
      try {
        this.allPosts = await this._http.getPublishedPosts();
        this.loadingState = 'success';
        this.filteredPosts = this.allPosts;
        this.getUniqueKeywords();
      } catch (error) {
        this.loadingState = 'failed';
        console.log(error);
      }
    });
    
  }

  ngAfterViewInit() {
    this.arrows.changes.subscribe( () => {
      this.checkArrows();
    });
    
    this.browser.changes.subscribe( () => {
      this.browser.first.nativeElement.addEventListener("scrollend", this.checkArrows.bind(this));
    });
  }

  checkArrows() {
    this.arrows.forEach( (arrow) => {

      const scrollPosition = this.browser.first.nativeElement.scrollLeft;
      const maxScrollPosition = this.browser.first.nativeElement.scrollWidth - this._screen.width - 18;

      if (arrow.nativeElement.classList.contains("left")) {
        arrow.nativeElement.style.opacity = this.browser.first.nativeElement.scrollLeft !== 0 ? "1" : "0";
      } else if (arrow.nativeElement.classList.contains("right")) {
        arrow.nativeElement.style.opacity = scrollPosition < 0.9 * maxScrollPosition  ? "1" : "0";
      }

    })
  }

  public onClickLeft() {
    this.browser.first.nativeElement.scrollLeft -= this._screen.width * 0.9;
  }

  public onClickRight() {
    this.browser.first.nativeElement.scrollLeft += this._screen.width * 0.9;  
  }

  getUniqueKeywords() {
    let kws: Array<string> = [];
    this.allPosts.forEach(p => {
      p.keywords.forEach(kw => {
        if(kw !== '' && !kws.includes(kw)) {
          kws.push(kw);
        }
      })
    })
    this.uniqueKeywords = kws.sort((a, b) => a.localeCompare(b));
    this.selectedKeywords = this.uniqueKeywords;
  }

  onFilter(kw: string) {
    // if the kw is in then take it out, if it is out then put it in
    if (this.selectedKeywords.includes(kw)) {
      this.selectedKeywords = this.selectedKeywords.filter(skw=>skw!=kw);
    } else {
      this.selectedKeywords.push(kw);
    }
    this.filterBlogCards();
  }

  filterBlogCards() {
    this.filteredPosts = this.allPosts.filter( p => p.keywords.some( kw => this.selectedKeywords.includes(kw)) );
  }

  selectAll() {
    this.selectedKeywords = this.uniqueKeywords;
    this.filterBlogCards();
  }

  selectNone() {
    this.selectedKeywords = [];
    this.filterBlogCards();
  }
}
