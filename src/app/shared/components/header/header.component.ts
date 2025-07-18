import { AfterContentChecked, AfterViewInit, Component, ElementRef, Inject, OnDestroy, PLATFORM_ID, QueryList, ViewChild, ViewChildren } from '@angular/core';
import { ScrollspyService } from '@shared/services/scrollspy.service';
import { ScreenService } from '@shared/services/screen.service';
import { filter, Subscription } from 'rxjs';
import { CommonModule, DOCUMENT, isPlatformBrowser } from '@angular/common';
import { Router, ActivatedRoute, RouterLink, NavigationEnd} from '@angular/router';
import { YoutubeSvgComponent } from '@shared/svg/youtube/youtube.component'
import { InstagramSvgComponent } from '@shared/svg/instagram/instagram.component'
import { EmailSvgComponent } from '@shared/svg/email/email.component'

@Component({
  standalone: true,
  providers: [],
  imports: [ RouterLink, CommonModule, YoutubeSvgComponent, InstagramSvgComponent, EmailSvgComponent  ],
  selector: 'app-header',
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.css']
})

export class HeaderComponent implements AfterViewInit, AfterContentChecked, OnDestroy {

  @ViewChildren('animate') animateElements!: QueryList<ElementRef>;
  @ViewChild('brandbox') brandBox!: ElementRef;

  private _scrSubs: Subscription | null = null;
  private _routeSubs: Subscription | null = null;

  public menuItems: Array<{name: string, anchor: string}> = [
    { name: 'Home',    anchor: 'home' },
    { name: 'Blog',    anchor: 'blog' },
    { name: 'Map',     anchor: 'map' },
    { name: 'Book',    anchor: 'snorkelling-britain' },
    { name: 'Shop',    anchor: 'buy-now' },
    { name: 'Friends', anchor: 'buy-now' },

  ];
  public expandDropdownMenu: boolean = false;
  public activeMenuItem?: string = 'Home';
  public isLoaded: boolean = false;

  constructor(
    @Inject(ActivatedRoute) private _route: ActivatedRoute,
    @Inject(Router) private _router: Router,
    @Inject(DOCUMENT) private _document: Document,    
    private _scrollSpy: ScrollspyService,
    private _screen: ScreenService,
  ) {
    this._router.events.pipe(filter( (e: any) => e instanceof NavigationEnd))
      .subscribe( () => {
        this._scrSubs = this._scrollSpy.intersectionEmitter.subscribe( (isect) => {
          if (isect.ratio > 0.2) {
            this.activeMenuItem = this.menuItems.find( item => item.anchor === isect.id)?.name;
          };
        });
    });
  }
 
  ngAfterViewInit() {
    if (this._screen.widthDescriptor === 'large') {
      this.expandDropdownMenu = false;
    }
  }
  
  ngAfterContentChecked() {
    if (!isPlatformBrowser(PLATFORM_ID)) {
      this.isLoaded = true;
    }
  }

  onHamburgerClick() {
    this.brandBox.nativeElement.classList.remove("block-animation");
    this.expandDropdownMenu = !this.expandDropdownMenu;
    this.animateHamburger();
  }

  onMenuItemClick() {
    if (this.expandDropdownMenu) {
      this.expandDropdownMenu = false;
      this.animateHamburger();
    }
  }

  animateHamburger() {
    this.animateElements.toArray().forEach( (anim) => {
      anim.nativeElement.beginElement();
    });
    this.toggleAnimationDirection();
  }

  // Reverse svg animation using js - makes svg definition more simple
  toggleAnimationDirection() {
    this.animateElements.toArray().forEach( (anim) => {
      let from = anim.nativeElement.getAttribute("from");
      let to   = anim.nativeElement.getAttribute("to");
      anim.nativeElement.setAttribute('from', to!);
      anim.nativeElement.setAttribute('to', from!);
    });
  }


  ngOnDestroy() {
    this._scrSubs?.unsubscribe();
    this._routeSubs?.unsubscribe();
  }

}
