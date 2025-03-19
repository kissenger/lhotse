import { ActivatedRoute, RouterLink} from '@angular/router';
import { isPlatformBrowser, NgClass, NgOptimizedImage } from '@angular/common';
import { AfterContentChecked, AfterViewInit, Component, ElementRef, Inject, PLATFORM_ID, QueryList, ViewChildren } from '@angular/core';
import { Subscription } from 'rxjs';
import { ScreenService } from '@shared/services/screen.service';
import { ScrollspyService } from '@shared/services/scrollspy.service';
import { AboutUsComponent } from '@pages/main/about/about.component';
import { SlideshowComponent } from '@pages/main/slideshow/slideshow.component';
import { ExploreComponent } from '@pages/main/explore/explore.component';
import { FAQComponent } from '@pages/main/faq/faq.component';
import { PartnersComponent } from '@pages/main/partners/partners.component';
import { BookComponent } from '@pages/main/book/book.component';
import { SEOService } from '@shared/services/seo.service';
import { BlogBrowserComponent } from '@pages/blog/browser/browser.component';
import { BasketComponent } from '@pages/main/basket/basket.component';

@Component({
  standalone: true,
  providers: [BlogBrowserComponent, ScreenService],
  imports: [
    SlideshowComponent, AboutUsComponent, ExploreComponent, BasketComponent,
    FAQComponent, PartnersComponent, BookComponent, NgClass, RouterLink, NgOptimizedImage
  ],
  selector: 'app-main',
  templateUrl: './main.component.html',
  styleUrls: ['./main.component.css']
})

export class MainComponent implements AfterViewInit, AfterContentChecked {

  @ViewChildren('window') windows!: QueryList<ElementRef>;
  @ViewChildren('anchor') anchors!: QueryList<ElementRef>;

  private _dataSubs: Subscription;
  private _scrSubs: Subscription | null = null;
  public isBlogData: boolean = true;
  public hideAboutBookOverlay: Boolean = false;
  public hideBuyNowOverlay: Boolean = true;
  public widthDescriptor?: string;
  public isReadyToLoad = false;

  staticBackgrounds: {[windowOne: string]: string} = {
    windowOne: "./assets/photos/parallax/scorpionfish-photographed-while-snorkelling-in-cornwall.webp",
    windowTwo: "./assets/photos/parallax/cuddling-crabs-snorkelling-scotland-britain.webp",
    windowThree: "./assets/photos/parallax/child-in-snorkelling-gear-scotland.webp",
    windowFour: "./assets/photos/parallax/dahlia-anemone-snorkelling-dorset-britain.webp"
  }

  constructor(
    @Inject(PLATFORM_ID) private platformId: any,
    private _route: ActivatedRoute,
    private _scrollSpy: ScrollspyService,
    private _screen: ScreenService,
    private _seo: SEOService,
    private _blogBrowserComponent: BlogBrowserComponent
  ) {
    this._seo.updateCanonincalUrl(this._route.snapshot.url.join('/'));
    this._seo.updateTitle('Snorkelology - British Snorkelling For All');
    this._seo.updateKeywords(`snorkel, snorkeling, snorkling, snorkelling, britain, british, UK, united kingdom, great britain,
      underwater, sealife, marinelife, wales, scotland, england`);
    this._seo.updateDescription(`Snorkelology is a website dedicated to snorkelling in Britain. Explore rich blog posts detailing the wonderful
      British marine environment, view inspiring underwater photography, and buy our new book: Snorkelling Britain.`);
    this._seo.addStructuredData(`{
      "@context": "http://schema.org",
      "@type": "Organization",
      "name": "Snorkelology",
      "url": "https://snorkelology.co.uk",
      "logo": "https://snorkelology.co.uk/banner/snround.webp",
      "description": "Snorkelology is a website dedicated to snorkelling in Britain. Explore rich blog posts detailing the wonderful British marine environment, view inspiring underwater photography, and buy our new book: Snorkelling Britain.",
      "sameAs": "https://instagram.com/snorkelology"
    }`)

    this._dataSubs = this._blogBrowserComponent.isBlogDataEmitter.subscribe( (value) => {
      this.isBlogData = value;
    });
  }

    
  ngAfterContentChecked() {
    if (!isPlatformBrowser(PLATFORM_ID)) {
      this.isReadyToLoad = true;
    }
  }
  
  ngAfterViewInit() {
    this._scrollSpy.observeChildren(this.anchors);   // subscribed to in header component
    this.loadBackgroundImages();
    this.widthDescriptor = this._screen.widthDescriptor;
    this._screen.resize.subscribe( (hasOrientationChanged) => {
      this.widthDescriptor = this._screen.widthDescriptor;
      if (hasOrientationChanged) {
        this.loadBackgroundImages();
      }
    });
    this._scrSubs = this._scrollSpy.intersectionEmitter.subscribe( (isect) => {
      if (isect.ratio > 0.2) {
        if (isect.id === "buy-now" || isect.id === "snorkelling-britain") {
          this.hideAboutBookOverlay = true;
        }
        if (isect.id === "snorkelling-britain") {
          this.hideBuyNowOverlay = false;
        } else {
          this.hideBuyNowOverlay = true;
        }
    
      }
    })
  }

  loadBackgroundImages() {
    this.windows.forEach( (w) => {
      // dont try to load on the server as we dont have a screen size and therefore dont know which image to load
      if (isPlatformBrowser(this.platformId)) {
        const elementId: string = w.nativeElement.id;
        let url = this.staticBackgrounds[elementId].replace('.webp',`-${this._screen.deviceOrientation}.webp`);        
        w.nativeElement.style.backgroundImage = `url('${url}')`;        
        w.nativeElement.style.backgroundAttachment = 'fixed';
        w.nativeElement.style.backgroundSize = 'cover';
        w.nativeElement.style.backgroundPosition = 'center';
      }
    })
  }

  hideOverlay(overlay: string) {
    console.log(overlay)
    if (overlay === 'buy-now') {
      this.hideBuyNowOverlay = true;
    } else if (overlay === 'about-book') {
      this.hideAboutBookOverlay = true;
    }
    console.log(this.hideAboutBookOverlay)

  }

  ngOnDestroy() {
    this._dataSubs?.unsubscribe();
    this._scrSubs?.unsubscribe();
  }

}

