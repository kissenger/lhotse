import { Inject, Injectable, PLATFORM_ID } from '@angular/core';
import { CanActivate, Router } from '@angular/router';
import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { environment } from '../environments/environment';

/**
 * Blocks access on non-dev stages unless the request is on the admin subdomain.
 */

@Injectable()
export class AdminSubdomainGuard implements CanActivate {

  constructor(
    private router: Router,
    @Inject(DOCUMENT) private _document: Document,
    @Inject(PLATFORM_ID) private _platformId: object,
  ) {}

  canActivate(): boolean {
    // During SSR, window location can be unavailable/empty. Defer host check to browser.
    if (!isPlatformBrowser(this._platformId)) {
      return true;
    }

    if (environment.STAGE !== 'dev') {
      const hostname = this._document.defaultView?.location.hostname ?? '';
      if (!hostname.startsWith('admin.')) {
        this.router.navigate(['/404']);
        return false;
      }
    }
    return true;
  }
}
