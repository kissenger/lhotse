
import { ElementRef, EventEmitter, Inject, Injectable, NgZone, PLATFORM_ID, QueryList } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

@Injectable({
  providedIn: 'root'
})

export class ScrollspyService {

  public intersectionEmitter = new EventEmitter<{id: string, class: string, ratio: number}>();
  private _isBrowser: boolean;
  private _activeAnchorId?: string;
  private _scheduledFrameId?: number;

  constructor(
    @Inject(PLATFORM_ID) private platformId: any,
    private ngZone: NgZone
  ) {
    this._isBrowser = isPlatformBrowser(this.platformId);

    if (this._isBrowser) {
      this.ngZone.runOutsideAngular(() => {
        window.addEventListener('scroll', this.scheduleActiveAnchorRefresh, { passive: true });
        window.addEventListener('resize', this.scheduleActiveAnchorRefresh);
      });

      this.scheduleActiveAnchorRefresh();
    }
  }

  observeChildren(_: QueryList<ElementRef>) {
    // Backwards-compatible API: callers trigger recomputation after anchor lists change.
    this.scheduleActiveAnchorRefresh();
  };

  intersectHandler(_: Array<IntersectionObserverEntry>) {
    // Retained for compatibility with existing tests and call sites.
    this.scheduleActiveAnchorRefresh();
  }

  private scheduleActiveAnchorRefresh = () => {
    if (!this._isBrowser || this._scheduledFrameId) {
      return;
    }

    this._scheduledFrameId = window.requestAnimationFrame(() => {
      this._scheduledFrameId = undefined;
      this.refreshActiveAnchor();
    });
  };

  private refreshActiveAnchor() {
    const headerOffset = this.getHeaderOffset();
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;
    const trackedAnchors = this.getTrackedAnchors();

    const visibleAnchors = trackedAnchors
      .map((element) => {
        const rect = element.getBoundingClientRect();
        const visibleTop = Math.max(rect.top, headerOffset);
        const visibleBottom = Math.min(rect.bottom, viewportHeight);
        const visibleHeight = Math.max(0, visibleBottom - visibleTop);
        const ratio = rect.height > 0 ? visibleHeight / rect.height : 0;

        return { element, rect, ratio };
      })
      .filter(({ ratio, rect }) => ratio > 0 && rect.bottom > headerOffset && rect.top < viewportHeight);

    if (!visibleAnchors.length) {
      return;
    }

    const activeAnchor = visibleAnchors.sort((left, right) => {
      const leftDistance = Math.abs(left.rect.top - headerOffset);
      const rightDistance = Math.abs(right.rect.top - headerOffset);

      if (leftDistance !== rightDistance) {
        return leftDistance - rightDistance;
      }

      const leftIsAboveHeader = left.rect.top <= headerOffset;
      const rightIsAboveHeader = right.rect.top <= headerOffset;
      if (leftIsAboveHeader !== rightIsAboveHeader) {
        return leftIsAboveHeader ? -1 : 1;
      }

      return right.ratio - left.ratio;
    })[0];

    if (!activeAnchor || activeAnchor.element.id === this._activeAnchorId) {
      return;
    }

    this._activeAnchorId = activeAnchor.element.id;
    this.ngZone.run(() => {
      this.intersectionEmitter.emit({
        id: activeAnchor.element.id,
        class: activeAnchor.element.className,
        ratio: activeAnchor.ratio
      });
    });
  }

  private getHeaderOffset(): number {
    const rootStyles = getComputedStyle(document.documentElement);
    const headerHeight = rootStyles.getPropertyValue('--header-height').trim();
    const parsedHeaderHeight = Number.parseFloat(headerHeight);

    return Number.isFinite(parsedHeaderHeight) ? parsedHeaderHeight : 75;
  }

  private getTrackedAnchors(): Array<HTMLElement> {
    const trackedAnchors = Array.from(document.querySelectorAll('[data-scrollspy-anchor]'))
      .filter((element): element is HTMLElement => element instanceof HTMLElement);

    if (trackedAnchors.length) {
      return trackedAnchors;
    }

    return [];
  }
}
