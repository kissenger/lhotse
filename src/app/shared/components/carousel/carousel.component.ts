import { AfterViewInit, Component, ElementRef, Inject, Input, PLATFORM_ID, QueryList, ViewChild, ViewChildren } from '@angular/core';
import { CommonModule, isPlatformBrowser, NgOptimizedImage } from '@angular/common';
import { SvgArrowComponent } from '../svg-arrow/svg-arrow.component';
import { CarouselImages } from '@shared/types';
import { BehaviorSubject, delay, interval, Observable, Subscription, switchMap, timer } from 'rxjs';

@Component({
  standalone: true,
  imports: [CommonModule, NgOptimizedImage, SvgArrowComponent],
  selector: 'app-carousel',
  templateUrl: './carousel.component.html',
  styleUrls: ['./carousel.component.css']
})
export class CarouselComponent implements AfterViewInit{

  @Input() public images: CarouselImages = []; 
  @Input() public objectFit: 'cover' | 'contain' = 'cover';
  @Input() public autoAdvance?: boolean = false;
  @ViewChildren('imageContainer') imageContainers!: QueryList<ElementRef>;
  @ViewChildren('carouselImage') carouselImages!: QueryList<ElementRef>;
  @ViewChild('carousel') carousel!: ElementRef;

  private _currentImage: number = 0;
  private _timerSubscription?: Subscription;
  private _timer?: Observable<any>;
  private _init = new BehaviorSubject(null);
  
  constructor(
    @Inject(PLATFORM_ID) private platformId: any
  ) {}

  ngOnInit() {
    this.images.push(this.images[0]);
  }

  ngAfterViewInit() {

    this.carousel.nativeElement.style.setProperty('--number-of-images', `${this.images.length}`);
    this.carouselImages.forEach( ci => ci.nativeElement.style.setProperty('object-fit', this.objectFit));

    if (isPlatformBrowser(this.platformId)) {
      if (this.autoAdvance) {
        this._timer = this._init.pipe(
          switchMap(() => interval(8000))
        )
        this._timerSubscription = this._timer.subscribe(() => this.showNextImage());
      }
    }
  }

  resetTimer() {
    this._init.next(null);
  }

  public async showNextImage() {
    if (this._currentImage === this.images.length-1) {
      this._currentImage = 0;    
      this._showImage(false);
      await this._sleep(10);  
    } 
    this._currentImage++;
    this._showImage(true);
  }

  public async showPrevImage() {
    if (this._currentImage === 0) {
      this._currentImage = this.images.length-1;
      this._showImage(false);
      await this._sleep(10);  
    }
    this._currentImage--;
    this._showImage(true);
  }

  private async _showImage(withAnimation: boolean = true) {
    this.resetTimer();
    this.carousel.nativeElement.style.transitionProperty = withAnimation ? 'all' : 'none';
    this.carousel.nativeElement.style.transform = `translateX(-${this._currentImage * 100 / this.images.length}%)`;
  }

  private _sleep(ms: number) {
    return new Promise( (res) => {
      timer(ms).subscribe( () => {
        res(true);
      })
    });
  }

  ngOnDestroy() {
    this._timerSubscription?.unsubscribe();
  }
}
