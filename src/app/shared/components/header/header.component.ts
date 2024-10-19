import { AfterContentChecked, AfterViewInit, Component, ElementRef, Inject, OnDestroy, PLATFORM_ID, QueryList, ViewChildren } from '@angular/core';
import { ScrollspyService } from '../../services/scrollspy.service';
import { ScreenService } from '../../services/screen.service';
import { Subscription } from 'rxjs';
import { CommonModule, isPlatformBrowser, provideImgixLoader } from '@angular/common';
import { ImageService } from '@shared/services/image.service';
import { environment } from '@environments/environment';
import { NgOptimizedImage } from '@angular/common';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

@Component({
  standalone: true,
  providers: provideImgixLoader(`https://${environment.IMGIX_DOMAIN}`),
  imports: [RouterLink, CommonModule, NgOptimizedImage, RouterOutlet, RouterLinkActive],
  selector: 'app-header',
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.css']
})

export class HeaderComponent implements AfterViewInit, AfterContentChecked, OnDestroy {

  @ViewChildren('menuItem') menuElements!: QueryList<ElementRef>; 
  @ViewChildren('animate') animateElements!: QueryList<ElementRef>;

  private _scrSubs: Subscription;
  // private _navSubs: Subscription;


  public menuItems = ['Home', 'About', 'Explore', 'Book', 'FAQs', 'Friends'];
  // public menuItemsFiltered: Array<{text: string, link: string, show: boolean, reload: boolean}> | undefined = this.menuItems;
  public expandDropdownMenu: boolean = false;
  public activeAnchor: string = 'about';
  public isLoaded: boolean = false;
  // public bannerImg;

  constructor(
    @Inject(PLATFORM_ID) private platformId: any,
    private _scrollSpy: ScrollspyService,
    public screen: ScreenService,
    public image: ImageService
  ) {

    // this.bannerImg = _image.sizedImage('snorkelology', 'extended');
    // console.log(this.screen.widthDescriptor)

    
    // observed elements are set in main component and tracked in scrollspy
    this._scrSubs = this._scrollSpy.intersectionEmitter.subscribe( (isect) => {
      if (isect.ratio > 0.2) {
        this.activeAnchor = isect.id;
        console.log(this.activeAnchor)
      }
    })

    // update menu items on route change
    // this._navSubs = this.navigate.end.subscribe( (url) => {
    //   let urlSplit = url.split('/');

    //   if ( urlSplit[1] === '' ) { this.menuItemsFiltered = this.filterMenu(['About', 'Explore', 'Book', 'FAQs', 'Friends', 'Articles']) }
    //   else if ( urlSplit[1] === 'subscribe' ) { this.menuItemsFiltered = this.filterMenu([]); }
    //   else if ( urlSplit[1] === 'privacy-policy' ) { this.menuItemsFiltered = this.filterMenu([]); }
    //   else if ( urlSplit[1] === 'snorkelling-in-britain' ) {
    //     if ( urlSplit.length === 2 ) { this.menuItemsFiltered = this.filterMenu([]); }
    //     else  { this.menuItemsFiltered = this.filterMenu([]); }
    //   }

    // })

  }

  // filterMenu(items: Array<string>) {
  //   return this.menuItems.filter( (item) => items.includes(item.text) );
  // }

  ngAfterViewInit() {
    if (this.screen.widthDescriptor === 'large') {
      this.expandDropdownMenu = false;
    }
    // console.log(this.screen.widthDescriptor)
  }
  
  ngAfterContentChecked() {
    // console.log(isPlatformBrowser(this.platformId));
    // console.log(isPlatformServer(this.platformId));
    // console.log(PLATFORM_ID)
    // console.log(this.platformId);

    if (!isPlatformBrowser(PLATFORM_ID)) {
      this.isLoaded = true;

    }
  }

  onHamburgerClick() {
    this.expandDropdownMenu = !this.expandDropdownMenu;
    this.animateHamburger();
  }

  onMenuItemClick(elemName: string) {
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
    // this._navSubs?.unsubscribe();
  }

}
