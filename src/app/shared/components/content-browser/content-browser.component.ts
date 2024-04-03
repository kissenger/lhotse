import { Component, OnDestroy, ElementRef, ViewChild} from '@angular/core';
import { UICardComponent } from '../ui-card/ui-card.component';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { HttpService } from '../../services/http.service';
import { NavService } from '../../services/nav.service';
import { ImageService } from '../../services/image.service';
import { ScreenService } from '../../services/screen.service';
import { Article, ArticlePreview, InstaPost } from '../../types';
import { _articles } from '../../db-articles';


@Component({
  standalone: true,
  imports: [UICardComponent, CommonModule],
  selector: 'app-content-browser',
  templateUrl: './content-browser.component.html',
  styleUrls: ['./content-browser.component.css'],
})

export class ContentBrowserComponent implements OnDestroy {

  @ViewChild('ckInsta') ckInstaElem!: ElementRef;
  @ViewChild('ckArticle') ckArticleElem!: ElementRef;
  
  private _httpSubs: Subscription | undefined;
  private _screenSubs: Subscription | undefined;
  private _navSubs: Subscription;
  private _limitPosts: boolean = false;
  private _previews: Array<ArticlePreview> = [];

  public isLoaded: boolean = false;
  public cards: Array<InstaPost | ArticlePreview> = [];
  public instas: Array<InstaPost> = [];
  public ckbtns: { [name: string]: { clicked: boolean } } = {
    article: { clicked: true },
    insta:   { clicked: true }
  } 

  constructor(
    private _screen: ScreenService,
    private _http: HttpService,
    private _navigate: NavService,
    private _images: ImageService
  ) {

    // get instgram posts
    this._httpSubs = this._http.getInstaPosts()
      .subscribe({
        next: (result: {data: Array<InstaPost>}) => {
          this.instas = result.data
            .filter( (m: InstaPost) => m.media_type != "VIDEO")
            .map( (m: InstaPost) => { m.category = 'Instagram'; return m; })
          this.updateFeed();
          this.isLoaded = true;
        },
        error: (error) => {
          console.log(error);
          this.isLoaded = true;
        }
      })  
  
    // construct article previews
    this._previews = _articles.map( (article: Article) => {
      return {
        caption: article.caption,
        header: article.header,
        category: 'Article',
        media_url: article.imagePath,
        permalink: article.href,
        timestamp: '',
        media_type: ''
      }
    })

    this._screenSubs = this._screen.resize.subscribe( () => {
      this.updateFeed();
    });

    this._navSubs = this._navigate.end.subscribe( (url) => {
      this._limitPosts = url === '/';
      this.updateFeed();
    })

  }

  onFilterClick(type: string) {

    // reverse click on relevent btn
    this.ckbtns[type].clicked = !this.ckbtns[type].clicked;

    // if both btns are now unclicked, reclick what we just unclicked, otherwise update
    if ( !this.ckbtns['insta'].clicked && !this.ckbtns['article'].clicked ) {
      this.ckbtns[type].clicked = !this.ckbtns[type].clicked;
    } else {
      this.updateFeed();
    }
  }

  updateFeed() {
    
    const nPosts = this._limitPosts ? this._screen.numberUIPosts : 99;

    // if there are no instas or theyve been filtered out, the only show articles
    if ( this.instas.length === 0  || this.ckbtns['article'].clicked && !this.ckbtns['insta'].clicked) {
      this.cards = [...this._previews];
    }

    // if there are instas and articles are filtered out, only show instas
    else if (this.ckbtns['insta'].clicked && !this.ckbtns['article'].clicked) {
      this.cards = [...this.instas];
    }

    // if there are instas and nothing is filtered, combine the two
    else {
      this.cards = [...this.instas];
      let index = 0;
      this._previews.forEach( (article) => {
        this.cards.splice(index,0,article);
        index+=2
      })
    }

    this.cards = this.cards.slice(0, nPosts);

  }

  ngOnDestroy(): void {
    this._httpSubs?.unsubscribe();
    this._screenSubs?.unsubscribe();
    this._navSubs?.unsubscribe();
  }

}



