import { Injectable } from '@angular/core';
import { HttpErrorResponse, HttpEvent, HttpHandler, HttpInterceptor, HttpRequest } from '@angular/common/http';
import { AuthService } from './auth.service';
import { catchError, Observable, throwError } from 'rxjs';
import { Router } from '@angular/router';

/**
 * puts the authorisation token in the header of all outgoing requests
 * https://medium.com/@ryanchenkie_40935/angular-authentication-using-the-http-client-and-http-interceptors-2f9d1540eb8
 */

@Injectable()
export class TokenInterceptor implements HttpInterceptor {

  constructor(
    private _auth: AuthService
  ) { }

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    const token = this._auth.token;
    if ( token ) {
      const tokenizedReq = req.clone({
        setHeaders: {
          Authorization: token
        }
      });
      return next.handle(tokenizedReq);
    } else {
      return next.handle(req);
    }
  }
}

@Injectable()
export class HttpErrorInterceptor implements HttpInterceptor {

  constructor(
    private _auth: AuthService,
    private _router: Router
  ) {}

  intercept(req: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    return next.handle(req).pipe(
      catchError((error: HttpErrorResponse) => {
        if (error.status===401) {
          this._auth.deleteCookies();
          this._router.navigate(['/admin']); 
        }
        return throwError(() => error);
      })
    );
  }
}
