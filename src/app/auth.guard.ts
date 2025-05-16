import { Injectable } from '@angular/core';
import {  CanActivate, Router } from '@angular/router';
import { AuthService } from './shared/services/auth.service';

/**
 * returns true if route is allowed and false if not allowed
 */

@Injectable()
export class AuthGuard implements CanActivate {

  constructor(
    private auth: AuthService,
    private router: Router,
  ) {}

  canActivate(): boolean {

    if ( this.auth.isLoggedIn ) {
      return true;
    } else {

      // if not logged in, store the url and redirect to login
      // this.set({redirect: url});
      this.router.navigate(['/admin/login']);
      return false;

    }
  }
}
