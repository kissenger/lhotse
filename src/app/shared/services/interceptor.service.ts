import { Inject, Injectable, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpErrorResponse, HttpEvent, HttpHandler, HttpInterceptor, HttpRequest } from '@angular/common/http';
import { AuthService } from './auth.service';
import { catchError, Observable, throwError } from 'rxjs';
import { Router } from '@angular/router';

/**
 * Attaches withCredentials to all /api/ requests so the browser automatically
 * sends the HttpOnly JWT cookie, without exposing the token to JavaScript.
 */

@Injectable()
export class TokenInterceptor implements HttpInterceptor {

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    if (req.url.startsWith('/api/')) {
      return next.handle(req.clone({ withCredentials: true }));
    }
    return next.handle(req);
  }
}

@Injectable()
export class HttpErrorInterceptor implements HttpInterceptor {

  constructor(
    private _auth: AuthService,
    private _router: Router,
    @Inject(PLATFORM_ID) private _platformId: object,
  ) {}

  intercept(req: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    return next.handle(req).pipe(
      catchError((error: HttpErrorResponse) => {
        if (error.status === 401 && isPlatformBrowser(this._platformId)) {
          this._auth.deleteCookies();
          this._router.navigate(['/login']); 
        }
        return throwError(() => error);
      })
    );
  }
}

