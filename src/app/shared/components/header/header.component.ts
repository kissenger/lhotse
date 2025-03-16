import { AfterContentChecked, AfterViewInit, Component, ElementRef, Inject, OnDestroy, PLATFORM_ID, QueryList, ViewChildren } from '@angular/core';
import { ScrollspyService } from '@shared/services/scrollspy.service';
import { ScreenService } from '@shared/services/screen.service';
import { filter, Subscription } from 'rxjs';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Router, ActivatedRoute, RouterLink, NavigationEnd} from '@angular/router';

@Component({
  standalone: true,
  providers: [],
  imports: [RouterLink, CommonModule],
  selector: 'app-header',
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.css']
})

export class HeaderComponent implements AfterViewInit, AfterContentChecked, OnDestroy {

  @ViewChildren('animate') animateElements!: QueryList<ElementRef>;

  private _scrSubs: Subscription | null = null;
  private _routeSubs: Subscription | null = null;

  public menuItems: Array<{name: string, anchor: string}> = [];
  public expandDropdownMenu: boolean = false;
  public activeAnchor: string = 'about-us';
  public isLoaded: boolean = false;

  constructor(
    @Inject(ActivatedRoute) private _route: ActivatedRoute,
    @Inject(Router) private _router: Router,
    private _scrollSpy: ScrollspyService,
    private _screen: ScreenService,
  ) {

    this._router.events
      .pipe(filter( (e: any) => e instanceof NavigationEnd))
      .subscribe( () => {

          //get menu items from router
          this.menuItems = this._route.firstChild?.snapshot.data['menuItems'];

          //once we know where we are, set active anchor with statically or using scrollspy
          // if (this._router.routerState.snapshot.url.match('blog')) {
          //   this.activeAnchor = 'explore';
          // } else {
            this._scrSubs = this._scrollSpy.intersectionEmitter.subscribe( (isect) => {
              if (isect.ratio > 0.2) {
                if (isect.id === "buy-now") {
                  this.activeAnchor = "snorkelling-britain";
                } else {
                  this.activeAnchor = isect.id;
                }
              }
            })
          // }
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
