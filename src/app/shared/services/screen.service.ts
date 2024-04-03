import { EventEmitter, Inject, Injectable, NgZone, OnDestroy, PLATFORM_ID } from '@angular/core';
import { DeviceOrientation, WidthDescriptor } from '../types';
import { ViewportRuler } from '@angular/cdk/scrolling';
import { Subscription } from 'rxjs';
import { isPlatformBrowser } from '@angular/common';

@Injectable({
  providedIn: 'root'
})

export class ScreenService implements OnDestroy{

  public resize = new EventEmitter<any>();

  private _screenWidth: number = 0;
  private _screenHeight: number = 0;
  private _widthThreshold = 768;
  private _deviceOrientation?: DeviceOrientation = undefined;
  private _widthDescriptor?: WidthDescriptor = undefined;
  private _aspectRatio = 0;
  private _containerWidth: number = 0;
  private _numberUIPosts: number = 0;
  private _viewportChangeSubs: Subscription | undefined;
  private _hasOrientationChanged: boolean = false;

  constructor(
    @Inject(PLATFORM_ID) private platformId: Object,
    private viewportRuler: ViewportRuler,
    private ngZone: NgZone
  ) {
    if (isPlatformBrowser(this.platformId)) {
      this.onResize();
    }
    this._viewportChangeSubs = this.viewportRuler.change(200).subscribe(() => {
      this.ngZone.run(() => {
        this.onResize();
        this.resize.emit(this._hasOrientationChanged);
      })
    });
  }

  onResize() {
    const {width, height} = this.viewportRuler.getViewportSize();
    this._screenWidth = width;
    this._screenHeight = height;
    let lastOrientation = this._deviceOrientation;
    this._deviceOrientation = (height / width) > 1.4 ? 'portrait' : 'landscape';
    this._hasOrientationChanged = lastOrientation != this._deviceOrientation;
    this._widthDescriptor = (width < this._widthThreshold) ? 'small' : 'large';
    // console.log(this._widthDescriptor);
    this._aspectRatio = height / width;

    if      ( this._screenWidth < 575 )  { this._containerWidth = this._screenWidth - 20 }
    else if ( this._screenWidth < 768 )  { this._containerWidth = 540  }
    else if ( this._screenWidth < 992 )  { this._containerWidth = 720  }
    else if ( this._screenWidth < 1200 ) { this._containerWidth = 960  }
    else if ( this._screenWidth < 1400 ) { this._containerWidth = 1140 }
    else                                 { this._containerWidth = 1320 };

    if ( this._containerWidth < 600 ) this._numberUIPosts = 4;      // 4 rows of 1
    else if (this._containerWidth < 900 ) this._numberUIPosts = 4;  // 2 rows of 2
    else if (this._containerWidth < 1200 ) this._numberUIPosts = 6; // 2 rows of 3
    else this._numberUIPosts = 8;                                   // 2 rows of 4

  }

  get numberUIPosts() {
    return this._numberUIPosts;
  }

  get containerWidth(): number {
    return this._containerWidth;
  }

  get deviceOrientation(): DeviceOrientation {
    return this._deviceOrientation;
  }

  get widthDescriptor() {
    return this._widthDescriptor;
  }

  get width() {
    return this._screenWidth;
  }

  get height() {
    return this._screenHeight;
  }

  get aspectRatio() {
    return this._aspectRatio;
  }

  ngOnDestroy(): void {
    this._viewportChangeSubs?.unsubscribe();
  }

}



