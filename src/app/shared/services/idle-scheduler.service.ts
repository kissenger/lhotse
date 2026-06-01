import { Inject, Injectable, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

@Injectable({
  providedIn: 'root'
})
export class IdleSchedulerService {
  private readonly _isBrowser: boolean;

  constructor(@Inject(PLATFORM_ID) platformId: object) {
    this._isBrowser = isPlatformBrowser(platformId);
  }

  schedule(task: () => void, timeoutMs = 1500, fallbackDelayMs = 300): () => void {
    if (!this._isBrowser) {
      return () => {};
    }

    if (window.requestIdleCallback) {
      const id = window.requestIdleCallback(task, { timeout: timeoutMs });
      return () => window.cancelIdleCallback?.(id);
    }

    const timer = setTimeout(task, fallbackDelayMs);
    return () => clearTimeout(timer);
  }
}
