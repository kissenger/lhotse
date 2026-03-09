import { EventEmitter, inject, Inject, Injectable, NgZone, OnDestroy, PLATFORM_ID } from '@angular/core';
import { DeviceOrientation, WidthDescriptor } from '@shared/types';
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
  private _viewportChangeSubs: Subscription | undefined;
  private _hasOrientationChanged: boolean = false;
  private _viewportRuler = inject(ViewportRuler);

  constructor(
    @Inject(PLATFORM_ID) private platformId: Object,
    private ngZone: NgZone
  ) {
    if (isPlatformBrowser(this.platformId)) {
      this.onResize();
    }
    this._viewportChangeSubs = this._viewportRuler.change(200).subscribe(() => {
      this.ngZone.run(() => {
        this.onResize();
        this.resize.emit(this._hasOrientationChanged);
      })
    });
  }

  onResize() {
    const {width, height} = this._viewportRuler.getViewportSize();
    this._screenWidth = width;
    this._screenHeight = height;
    let lastOrientation = this._deviceOrientation;
    this._deviceOrientation = (height / width) > 1.4 ? 'portrait' : 'landscape';
    this._hasOrientationChanged = lastOrientation != this._deviceOrientation;
    this._widthDescriptor = (width < this._widthThreshold) ? 'small' : 'large';
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

  ngOnDestroy(): void {
    this._viewportChangeSubs?.unsubscribe();
  }

}



