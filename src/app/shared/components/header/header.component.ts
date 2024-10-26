import { AfterContentChecked, AfterViewInit, Component, ElementRef, Inject, OnDestroy, PLATFORM_ID, QueryList, ViewChildren } from '@angular/core';
import { ScrollspyService } from '../../services/scrollspy.service';
import { ScreenService } from '../../services/screen.service';
import { Subscription } from 'rxjs';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { ImageService } from '@shared/services/image.service';
import { NgOptimizedImage } from '@angular/common';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { DataService } from '@shared/services/data.service';

@Component({
  standalone: true,
  providers: [],
  imports: [RouterLink, CommonModule, NgOptimizedImage, RouterOutlet, RouterLinkActive],
  selector: 'app-header',
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.css']
})

export class HeaderComponent implements AfterViewInit, AfterContentChecked, OnDestroy {

  @ViewChildren('menuItem') menuElements!: QueryList<ElementRef>; 
  @ViewChildren('animate') animateElements!: QueryList<ElementRef>;

  private _scrSubs: Subscription;
  private _dataSubs: Subscription;


  public menuItems = ['Home', 'About', 'Explore', 'Book', 'FAQs', 'Friends'];
  public expandDropdownMenu: boolean = false;
  public activeAnchor: string = 'about';
  public isLoaded: boolean = false;
  public isBlogData: boolean = true;

  constructor(
    @Inject(PLATFORM_ID) private platformId: any,
    private _scrollSpy: ScrollspyService,
    public screen: ScreenService,
    public image: ImageService,
    private _data: DataService
  ) {

    // observed elements are set in main component and tracked in scrollspy
    this._scrSubs = this._scrollSpy.intersectionEmitter.subscribe( (isect) => {
      if (isect.ratio > 0.2) {
        this.activeAnchor = isect.id;
      }
    })

    this._dataSubs = this._data.isBlogDataEmitter.subscribe( (value) => {
      if (!value) {
        this.menuItems = this.menuItems.filter( mi => mi !== 'Explore');
      };
    });
  }
  

  ngAfterViewInit() {
    if (this.screen.widthDescriptor === 'large') {
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
    this._dataSubs?.unsubscribe();
  }

}
