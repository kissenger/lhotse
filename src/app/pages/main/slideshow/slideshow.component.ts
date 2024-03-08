import { Component,  AfterViewInit, ViewChild, ViewChildren, QueryList, ElementRef, afterRender, afterNextRender } from '@angular/core';
import { CommonModule, NgOptimizedImage } from '@angular/common';
import { ImageService } from '@shared/services/image.service';
import { NavService } from '@shared/services/nav.service';
import { interval, timer } from 'rxjs';

@Component({
  standalone: true,
  imports: [NgOptimizedImage, CommonModule],
  selector: 'app-slideshow',
  templateUrl: './slideshow.component.html',
  styleUrls: ['./slideshow.component.css']
})
export class SlideshowComponent implements AfterViewInit{

  @ViewChild('slideshow') slideshowElement!: ElementRef; 
  @ViewChild('firstSlide') firstSlide!: ElementRef; 
  @ViewChildren('overlay') overlayElements!: QueryList<ElementRef>;
  
  public showTransition = true;
  private _delta = 0;
  private _mouseOver: boolean = false;

  constructor(
    public images: ImageService,
    public navigate: NavService
  ) {
    // auto advance - important that this is applied after rendering or hydration fails
    afterNextRender( () => {
      interval(8000).subscribe( ()=> {
        if (!this._mouseOver) {
          this._slideshowManager(true);
        }
      })
    })
  }

  async ngAfterViewInit() {

    // duplicate slide 1 and add as a child of slideshow
    this.slideshowElement.nativeElement.appendChild(
      this.firstSlide.nativeElement.cloneNode(true)
    );

    // inhibit autoscroll if mouse is over the slideshow (or arrow) element(s)
    this.overlayElements.toArray().forEach( (elem) => {
      elem.nativeElement.addEventListener('mousemove', () => { this._mouseOver = true;  });
      elem.nativeElement.addEventListener('mouseout', () =>  { this._mouseOver = false; });
    })

  }

  private _sleep(ms: number) {
    return new Promise( (res) => {
      timer(ms).subscribe( () => {
        res(true);
      })
    });
  }

  private _slideshowReset() {
    this.slideshowElement.nativeElement.style.transitionProperty = 'none';
    this.slideshowElement.nativeElement.style.transform = `translateX(-${this._delta * 25}%)`;
  }

  private _slideshowNext() {
    this.slideshowElement.nativeElement.style.transitionProperty = 'all';
    this.slideshowElement.nativeElement.style.transform = `translateX(-${this._delta * 25}%)`;
  }

  public onClick(advance: boolean) {
    this._slideshowManager(advance);
  }

  private async _slideshowManager(advance: boolean) {
    this._delta = advance ? ++this._delta : --this._delta;
    if (this._delta > 3) {
      this._delta = 0;
      this._slideshowReset();
      this._delta = advance ? ++this._delta : --this._delta;
    } else if (this._delta < 0) {
      this._delta = 3;
      this._slideshowReset();
      this._delta = advance ? ++this._delta : --this._delta;
    }
    await this._sleep(10);  // this is a hack, required otherwise transitionProperty = 'none' doesnt appear to register in time
    this._slideshowNext();
  }
}
