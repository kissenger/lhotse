import { Inject, Injectable, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

@Injectable({
  providedIn: 'root'
})
export class ScrollOffsetService {
  private readonly _isBrowser: boolean;

  constructor(@Inject(PLATFORM_ID) platformId: object) {
    this._isBrowser = isPlatformBrowser(platformId);
  }

  getHeaderHeight(): number {
    return this._getCssVarNumber('--header-height', 75);
  }

  getHeaderOverhang(): number {
    return this._getCssVarNumber('--header-overhang', 0);
  }

  getFragmentOffset(extra = 12): number {
    return this.getHeaderHeight() + this.getHeaderOverhang() + extra;
  }

  getHeaderOffset(extra = 0): number {
    return this.getHeaderHeight() + extra;
  }

  private _getCssVarNumber(name: string, fallback: number): number {
    if (!this._isBrowser) {
      return fallback;
    }

    const rootStyles = getComputedStyle(document.documentElement);
    const parsed = Number.parseFloat(rootStyles.getPropertyValue(name).trim());
    return Number.isFinite(parsed) ? parsed : fallback;
  }
}
