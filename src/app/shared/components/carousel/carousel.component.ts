import { AfterViewInit, Component, ElementRef, Inject, Input, QueryList, ViewChild, ViewChildren } from '@angular/core';
import { CommonModule, DOCUMENT, NgOptimizedImage } from '@angular/common';
import { SvgArrowComponent } from '../svg-arrow/svg-arrow.component';
import { timer } from 'rxjs/internal/observable/timer';

@Component({
  standalone: true,
  imports: [CommonModule, NgOptimizedImage, SvgArrowComponent],
  selector: 'app-carousel',
  templateUrl: './carousel.component.html',
  styleUrls: ['./carousel.component.css']
})
export class CarouselComponent implements AfterViewInit{

  @Input() public images: Array<{src: string, alt: string, priority?: boolean}> = []; 
  @Input() public height: string = ''; 
  @Input() public width: string = ''; 
  @ViewChildren('imageContainer') imageContainers!: QueryList<ElementRef>;
  @ViewChild('carousel') carousel!: ElementRef;
  @ViewChild('carouselContainer') carouselContainer!: ElementRef;

  private currentImage: number = 0;

  constructor(
    @Inject(DOCUMENT) private _document: Document
  ) {}

  ngAfterViewInit() {
    this.images.push(this.images[0]);
    this._document.documentElement.style.setProperty;
    this.carousel.nativeElement.style.setProperty('--number-of-images', `${this.images.length}`);
    this.carouselContainer.nativeElement.style.setProperty('height', this.height);
    this.carouselContainer.nativeElement.style.setProperty('width', this.width);
  }

  public async showNextImage() {
    if (this.currentImage === this.images.length-1) {
      this.currentImage = 0;    
      this._showImage(false);
      await this._sleep(10);  // this is a hack, required otherwise transitionProperty = 'none' doesnt appear to register in time
    } 
    this.currentImage++;
    this._showImage();
  }

  public async showPrevImage() {
    if (this.currentImage === 0) {
      this.currentImage = this.images.length-1;
      this._showImage(false);
      await this._sleep(10);  
    }
    this.currentImage--;
    this._showImage();
  }

  private _showImage(withAnimation: boolean = true) {
    this.carousel.nativeElement.style.transitionProperty = withAnimation ? 'all' : 'none';
    this.carousel.nativeElement.style.transform = `translateX(-${this.currentImage * 100 / this.images.length}%)`;
  }

  private _sleep(ms: number) {
    return new Promise( (res) => {
      timer(ms).subscribe( () => {
        res(true);
      })
    });
  }
}
