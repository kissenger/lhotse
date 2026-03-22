import { ActivatedRoute, RouterLink } from '@angular/router';
import { isPlatformBrowser, NgOptimizedImage } from '@angular/common';
import { AfterViewInit, ChangeDetectorRef, Component, ElementRef, Inject, OnDestroy, PLATFORM_ID, QueryList, ViewChildren } from '@angular/core';
import { Subscription } from 'rxjs';
import { ScreenService } from        '@shared/services/screen.service';
import { ScrollspyService } from     '@shared/services/scrollspy.service';
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
  providers: [],
  imports: [
    SlideshowComponent, AboutUsComponent, ShopComponent, MapComponent,
    FAQComponent, BlogComponent, PartnersComponent, BookComponent,
    RouterLink, NgOptimizedImage
],
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.css']
})

export class HomeComponent implements AfterViewInit, OnDestroy {

  @ViewChildren('window') windows!: QueryList<ElementRef>;
  @ViewChildren('anchor') anchors!: QueryList<ElementRef>;

  public hideAboutBookOverlay = false;
  public widthDescriptor?: string;
  private _subs: Subscription[] = [];
  private _fragmentScrollTimer?: ReturnType<typeof setTimeout>;

  staticBackgrounds: Record<string, string> = {
    windowOne: "./assets/photos/parallax/scorpionfish-photographed-while-snorkelling-in-cornwall.webp",
    windowTwo: "./assets/photos/parallax/cuddling-crabs-snorkelling-scotland-britain.webp",
    windowThree: "./assets/photos/parallax/child-in-snorkelling-gear-scotland.webp",
    windowFour: "./assets/photos/parallax/dahlia-anemone-snorkelling-dorset-britain.webp",
    windowFive: "./assets/photos/parallax/scorpionfish-photographed-while-snorkelling-in-cornwall.webp",
    windowSix: "./assets/photos/parallax/cuddling-crabs-snorkelling-scotland-britain.webp"
  }

  constructor(
    @Inject(PLATFORM_ID) private platformId: any,
    private _route: ActivatedRoute,
    private _scrollSpy: ScrollspyService,
    private _screen: ScreenService,
    private _cdr: ChangeDetectorRef,
  ) {}

  ngAfterViewInit() {
    if (isPlatformBrowser(this.platformId)) {
      // Delay fragment scroll until deferred sections have had a chance to render.
      this._fragmentScrollTimer = setTimeout(() => {
        const fragment = this._route.snapshot.fragment;
        if (!fragment) {
          return;
        }
        document.querySelector(`#${fragment}`)?.scrollIntoView();
      }, 500);
    }

    this._subs.push(this._scrollSpy.intersectionEmitter.subscribe((isect) => {
      if (!this.hideAboutBookOverlay && isect.id !== 'home') {
        this.hideAboutBookOverlay = true;
        this._cdr.detectChanges();
      }
    }));

    // Observe initial anchors and keep observing when deferred views render.
    this._scrollSpy.observeChildren(this.anchors);
    this._subs.push(this.anchors.changes.subscribe(() => {
      this._scrollSpy.observeChildren(this.anchors);
    }));

    //watch for changes as querylist will change when deferred views are loaded
    this._subs.push(this.windows.changes.subscribe(() => {
      this.loadBackgroundImages();
    }));
 
    this.widthDescriptor = this._screen.widthDescriptor;
    this._subs.push(this._screen.resize.subscribe((hasOrientationChanged) => {
      this.widthDescriptor = this._screen.widthDescriptor;
      if (hasOrientationChanged) {
        this.loadBackgroundImages();
      }
    }));

  }

  loadBackgroundImages() {
    this.windows.forEach( (w) => {
      // dont try to load on the server as we dont have a screen size and therefore dont know which image to load
      if (isPlatformBrowser(this.platformId)) {
        // const isIOS = /iPad|iPhone|iPod/.test(navigator.platform) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
        const elementId: string = w.nativeElement.id;
        const baseUrl = this.staticBackgrounds[elementId];
        if (!baseUrl) {
          return;
        }
        const url = baseUrl.replace('.webp', `-${this._screen.deviceOrientation}.webp`);
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
    this._subs.forEach((sub) => sub.unsubscribe());
    if (this._fragmentScrollTimer) {
      clearTimeout(this._fragmentScrollTimer);
    }
  }

}