import { TokenInterceptor, HttpErrorInterceptor } from './interceptor.service';
import { AuthService } from './auth.service';
import { Router } from '@angular/router';
import { TestBed } from '@angular/core/testing';
import { HttpRequest, HttpHandler } from '@angular/common/http';
import { of, throwError } from 'rxjs';

describe('TokenInterceptor', () => {
  it('adds Authorization header when token present', () => {
    const mockAuth = { token: 'TOK' } as AuthService;
    const interceptor = new TokenInterceptor(mockAuth);
    const req = new HttpRequest('GET', '/test');
    const handler: any = { handle: (r: HttpRequest<any>) => of(r) };
    interceptor.intercept(req, handler).subscribe((res: any) => {
      expect(res.headers.get('Authorization')).toBe('TOK');
    });
  });

  it('passes through when no token', () => {
    const mockAuth = { token: null } as AuthService;
    const interceptor = new TokenInterceptor(mockAuth);
    const req = new HttpRequest('GET', '/test');
    const handler: any = { handle: (r: HttpRequest<any>) => of(r) };
    interceptor.intercept(req, handler).subscribe((res: any) => {
      expect(res.headers.has('Authorization')).toBeFalse();
    });
  });
});

describe('HttpErrorInterceptor', () => {
  let mockAuth: any;
  let mockRouter: any;
  let interceptor: HttpErrorInterceptor;

  beforeEach(() => {
    mockAuth = { deleteCookies: jasmine.createSpy('deleteCookies') };
    mockRouter = { navigate: jasmine.createSpy('navigate') } as any;
    interceptor = new HttpErrorInterceptor(mockAuth, mockRouter);
  });

  it('on 401 should call deleteCookies and navigate', (done) => {
    const req = new HttpRequest('GET', '/');
    const handler: any = { handle: () => throwError(() => ({ status: 401 })) };
    interceptor.intercept(req, handler).subscribe({
      next: () => {},
      error: (err: any) => {
        expect(mockAuth.deleteCookies).toHaveBeenCalled();
        expect(mockRouter.navigate).toHaveBeenCalledWith(['/admin']);
        done();
      }
    });
  });
});
