import { TokenInterceptor, HttpErrorInterceptor } from './interceptor.service';
import { Router } from '@angular/router';
import { HttpRequest, HttpHandler } from '@angular/common/http';
import { of, throwError } from 'rxjs';

describe('TokenInterceptor', () => {
  const interceptor = new TokenInterceptor();

  it('adds withCredentials to /api/ requests', () => {
    const req = new HttpRequest('GET', '/api/sites/get-sites/Production');
    const handler: any = { handle: (r: HttpRequest<any>) => of(r) };
    interceptor.intercept(req, handler).subscribe((res: any) => {
      expect(res.withCredentials).toBeTrue();
    });
  });

  it('does not add withCredentials to non-api requests', () => {
    const req = new HttpRequest('GET', '/some-asset.json');
    const handler: any = { handle: (r: HttpRequest<any>) => of(r) };
    interceptor.intercept(req, handler).subscribe((res: any) => {
      expect(res.withCredentials).toBeFalse();
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
        expect(mockRouter.navigate).toHaveBeenCalledWith(['/login']);
        done();
      }
    });
  });
});
