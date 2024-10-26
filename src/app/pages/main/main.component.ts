import { AfterViewInit, Component, ElementRef, Inject, PLATFORM_ID, QueryList, ViewChildren } from '@angular/core';
import { ImageService } from '@shared/services/image.service';
import { ScreenService } from '@shared/services/screen.service';
import { ScrollspyService } from '@shared/services/scrollspy.service';
import { AboutUsComponent } from '@pages/main/about/about.component';
import { SlideshowComponent } from '@pages/main/slideshow/slideshow.component';
import { ExploreComponent } from '@pages/main/explore/explore.component';
import { FAQComponent } from '@pages/main/faq/faq.component';
import { PartnersComponent } from '@pages/main/partners/partners.component';
import { BookComponent } from '@pages/main/book/book.component';
import { CommonModule, NgOptimizedImage, isPlatformBrowser } from '@angular/common';
import { SEOService } from '@shared/services/seo.service';
import { ActivatedRoute, RouterLink, RouterOutlet, RouterLinkActive } from '@angular/router';
import { HeaderComponent } from '@shared/components/header/header.component';
import { DataService } from '@shared/services/data.service';
import { Subscription } from 'rxjs';
import { BannerAdComponent } from "../../shared/components/banner-ad/banner-ad.component";


@Component({
  standalone: true,
  imports: [
    NgOptimizedImage, RouterOutlet, RouterLink, RouterLinkActive, HeaderComponent, CommonModule,
    SlideshowComponent, AboutUsComponent, ExploreComponent, FAQComponent, PartnersComponent, BookComponent,
    BannerAdComponent
],
  selector: 'app-main',
  templateUrl: './main.component.html',
  styleUrls: ['./main.component.css']
})

export class MainComponent implements AfterViewInit {

  @ViewChildren('window') windows!: QueryList<ElementRef>;
  @ViewChildren('anchor') anchors!: QueryList<ElementRef>;

  private _dataSubs: Subscription;
  public isBlogData: boolean = true;

  private plxImgs: {[id: string]: string} = {
    'windowOne'  : 'scorpionfish',
    'windowTwo'  : 'cuddlingcrabs',
    'windowThree': 'sittingchild',
    'windowFour' : 'anemone',
  }

  constructor(
    @Inject(PLATFORM_ID) private platformId: any,
    private _images: ImageService,
    private _route: ActivatedRoute,
    private _scrollSpy: ScrollspyService,
    private _screen: ScreenService,
    private _seo: SEOService,
    private _data: DataService
  ) {
    this._seo.updateCanonincalUrl(this._route.snapshot.url.join('/'));
    this._seo.updateTitle('Snorkelology - British Snorkelling For All The Family');
    this._seo.updateKeywords(`snorkel, snorkeling, snorkling, snorkelling, britain, british, UK, united kingdom, great britain, north sea,
    english channel, atlantic ocean, underwater, subsea, sea life, sealife, marine, life, wales, scotland, england, shore dive, shoredive,
    uk snorkelling, snorkelling near me`);
    this._seo.updateDescription(`Snorkelology is a website dedicated to snorkelling in Britain. Explore rich blog posts detailing the wonderful
      British marine environment, view inspiring underwater photography, and learn about our forecoming book: Snorkelling Britain.`);
  
    this._dataSubs = this._data.isBlogDataEmitter.subscribe( (value) => {
      this.isBlogData = value;
    });
  }
  
  ngAfterViewInit() {
    this._scrollSpy.observeChildren(this.anchors);   // subscribed to in header component
    this.loadBackgroundImages();
    this._screen.resize.subscribe( (hasOrientationChanged) => {
      if (hasOrientationChanged) {
        this.loadBackgroundImages();
      }
    })
  }

  loadBackgroundImages() {
    this.windows.forEach( (w) => {
      // dont try to load on the server as we dont have a screen size and therefore dont know which image to load
      if (isPlatformBrowser(this.platformId)) {
        // w.nativeElement.style.backgroundImage = this.plxImgs[w.nativeElement.id];
        let url = this._images.orientedImage(this.plxImgs[w.nativeElement.id]).url;        
        w.nativeElement.style.backgroundImage = `url('${url}')`;        
        w.nativeElement.style.backgroundAttachment = 'fixed';
        w.nativeElement.style.backgroundSize = 'cover';
        w.nativeElement.style.backgroundPosition = 'center';
      }
    })
  }

  ngOnDestroy() {
    this._dataSubs?.unsubscribe();
  }

}

