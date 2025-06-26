import { Component, ElementRef, EventEmitter, Inject, ViewChild } from '@angular/core';
import { HttpService } from '@shared/services/http.service';
import { ActivatedRoute } from '@angular/router';
import { BlogPost } from '@shared/types';
import { BlogCardComponent } from './blog-card/blog-card.component';
import { ScreenService } from '@shared/services/screen.service';
import { SvgArrowComponent } from '@shared/components/svg-arrow/svg-arrow.component';
import { CommonModule, DOCUMENT } from '@angular/common';


@Component({
  standalone: true,
  imports: [ BlogCardComponent, SvgArrowComponent, CommonModule ],
  selector: 'app-blog',
  templateUrl: './blog.component.html',
  styleUrls: ['../main.component.css', './blog.component.css'],
})

export class BlogComponent {

  @ViewChild('browser') browser!: ElementRef;
  @ViewChild('leftArrow') leftArrow!: ElementRef;
  @ViewChild('rightArrow') rightArrow!: ElementRef;

  public filteredPosts: Array<BlogPost> = [];
  public allPosts: Array<BlogPost> = [];
  public isBlogDataEmitter = new EventEmitter();
  public uniqueKeywords: Array<string> = [];
  public selectedKeywords: Array<string> = [];

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
        this.isBlogDataEmitter.emit(this.allPosts.length !== 0);
        this.filteredPosts = this.allPosts;
        this.getUniqueKeywords();
      } catch (error) {
        this.isBlogDataEmitter.emit(true);
        console.log(error);
      }
    });
    
  }

  ngAfterViewInit() {
    this.checkArrows();
    this.browser.nativeElement.addEventListener("scrollend", this.checkArrows.bind(this));
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

  public onClickRight() {
    this.browser.nativeElement.scrollLeft += this._screen.width * 0.9;  
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
