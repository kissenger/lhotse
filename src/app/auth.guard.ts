import { Inject, Injectable } from '@angular/core';
import { CanActivate, Router, ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { DOCUMENT } from '@angular/common';
import { AuthService } from './shared/services/auth.service';
import { environment } from '../environments/environment';

/**
 * returns true if route is allowed and false if not allowed.
 * On non-dev stages, admin routes are only accessible from the admin subdomain.
 */

@Injectable()
export class AuthGuard implements CanActivate {

  constructor(
    private auth: AuthService,
    private router: Router,
    @Inject(DOCUMENT) private _document: Document,
  ) {}

  canActivate(_route: ActivatedRouteSnapshot, state: RouterStateSnapshot): boolean {

    if (environment.STAGE !== 'dev') {
      const hostname = this._document.defaultView?.location.hostname ?? '';
      if (!hostname.startsWith('admin.')) {
        this.router.navigate(['/404']);
        return false;
      }
    }

    if ( this.auth.isLoggedIn ) {
      return true;
    } else {
      this.router.navigate(['/login'], { queryParams: { redirect: state.url } });
      return false;
    }
  }
}
