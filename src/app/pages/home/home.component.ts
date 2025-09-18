import { ActivatedRoute, RouterLink } from '@angular/router';
import { isPlatformBrowser, NgClass, NgOptimizedImage } from '@angular/common';
import { AfterContentChecked, AfterViewInit, Component, ElementRef, Inject, PLATFORM_ID, QueryList, ViewChildren } from '@angular/core';
import { ScreenService } from        '@shared/services/screen.service';
import { ScrollspyService } from     '@shared/services/scrollspy.service';
import { SEOService } from           '@shared/services/seo.service';
import { SlideshowComponent } from   '@pages/home/slideshow/slideshow.component';
import { AboutUsComponent } from     '@pages/home/about/about.component';
import { BlogComponent } from        '@pages/home/blog/blog.component';
import { MapComponent } from         '@pages/home/map/map.component';
import { BookComponent } from        '@pages/home/book/book.component';
import { ShopComponent } from        '@pages/home/shop/shop.component';
import { FAQComponent } from         '@pages/home/faq/faq.component';
import { PartnersComponent } from    '@pages/home/partners/partners.component';

@Component({
  standalone: true,
  providers: [BlogComponent, ScreenService],
  imports: [
    SlideshowComponent, AboutUsComponent, ShopComponent, MapComponent,
    FAQComponent, BlogComponent, PartnersComponent, BookComponent, NgClass,
    RouterLink, NgOptimizedImage
],
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.css']
})

export class HomeComponent implements AfterViewInit, AfterContentChecked {

  @ViewChildren('window') windows!: QueryList<ElementRef>;
  @ViewChildren('anchor') anchors!: QueryList<ElementRef>;

  public isBlogData = true;
  public hideAboutBookOverlay = false;
  public hideBuyNowOverlay = true;
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
    private _seo: SEOService
  ) {
        // this is a hack to fix the broken scroll to fragment feature in angular
    setTimeout(() => {
      let target = document.querySelector('#' + this._route.snapshot.fragment);
    console.log(target)
      if (target) {
        target?.scrollIntoView();
      }
    }, 500)
    
    this._seo.updateCanonincalUrl(this._route.snapshot.url.join('/'));
    this._seo.updateTitle('Snorkelology - From the Authors of Snorkelling Britain');
    this._seo.updateKeywords(`snorkel, snorkeling, snorkelling, snorkelling britain, british snorkelling,
      underwater photography, sealife, marinelife`);
    this._seo.updateDescription(`Snorkelology is a website from the authors of Snorkelling Britain - explore
      our website for snorkelling sites, snorkelling gear recommendations and inspiring underwater photography.`);
    this._seo.addStructuredData(`{
      "@context": "http://schema.org",
      "@type": "Organization",
      "name": "Snorkelology",
      "url": "https://snorkelology.co.uk",
      "logo": "https://snorkelology.co.uk/banner/snround.webp",
      "description": "Snorkelology is a website from the authors of Snorkelling Britain - explore our website for snorkelling sites, snorkelling gear recommendations and inspiring underwater photography.",
      "sameAs": [
        "https://instagram.com/snorkelology",
        "https://www.youtube.com/@snorkelology", 
        "https://www.facebook.com/snorkelology"
      ]
    }`)
    
  }

  ngAfterContentChecked() {
    if (!isPlatformBrowser(PLATFORM_ID)) {
      this.isReadyToLoad = true;
    }
  }
  
  ngAfterViewInit() {

    this._scrollSpy.observeChildren(this.anchors);   // subscribed to in header component

    //watch for changes as querylist will change when deferred views are loaded
    this.windows.changes.subscribe( () => {
      this.loadBackgroundImages();
    });
 
    this.widthDescriptor = this._screen.widthDescriptor;
    this._screen.resize.subscribe( (hasOrientationChanged) => {
      this.widthDescriptor = this._screen.widthDescriptor;
      if (hasOrientationChanged) {
        this.loadBackgroundImages();
      }
    });
    this._scrollSpy.intersectionEmitter.subscribe( (isect) => {
      if (isect.ratio > 0.2) {
        if (isect.id === "blog") {
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
        // const isIOS = /iPad|iPhone|iPod/.test(navigator.platform) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
        const elementId: string = w.nativeElement.id;
        let url = this.staticBackgrounds[elementId].replace('.webp',`-${this._screen.deviceOrientation}.webp`);        
        w.nativeElement.style.backgroundImage = `url('${url}')`;        
        w.nativeElement.style.backgroundSize = 'cover';
        w.nativeElement.style.backgroundPosition = 'center';
      }
    })
  }

  hideOverlay(overlay: string) {
    if (overlay === 'about-book') {
      this.hideAboutBookOverlay = true;
    }
  }

  ngOnDestroy() {
  }

}

