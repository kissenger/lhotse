import { ApplicationConfig } from '@angular/core';
import { provideRouter, withInMemoryScrolling, withRouterConfig } from '@angular/router';
import { routes } from './app.routes';
import { provideClientHydration } from '@angular/platform-browser';
import { HTTP_INTERCEPTORS, provideHttpClient, withFetch, withInterceptorsFromDi } from '@angular/common/http';
import { provideImgixLoader } from '@angular/common';
import { environment } from '@environments/environment';
import { AuthGuard } from './auth.guard';
import { TokenInterceptorService } from './shared/services/token-interceptor.service';


export const appConfig: ApplicationConfig = {
  providers: [
    AuthGuard,
    provideRouter(routes, 
      withRouterConfig({onSameUrlNavigation: 'reload'}),
      withInMemoryScrolling({scrollPositionRestoration: 'enabled',anchorScrolling: 'enabled'}),
    ), 
    provideClientHydration(),
    provideHttpClient(
      withFetch(),
      withInterceptorsFromDi()
    ),
    { provide: HTTP_INTERCEPTORS, useClass: TokenInterceptorService, multi: true},
    provideImgixLoader(`https://${environment.IMGIX_DOMAIN}`),
  ]
};

