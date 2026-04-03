import { ApplicationConfig } from '@angular/core';
import { provideRouter, withInMemoryScrolling, withRouterConfig, PreloadAllModules, withPreloading } from '@angular/router';
import { routes } from './app.routes';
import { provideClientHydration } from '@angular/platform-browser';
import { HTTP_INTERCEPTORS, provideHttpClient, withFetch, withInterceptorsFromDi } from '@angular/common/http';
import { provideImgixLoader } from '@angular/common';
import { environment } from '@environments/environment';
import { AuthGuard } from './auth.guard';
import { AdminSubdomainGuard } from './admin-subdomain.guard';
import { HttpErrorInterceptor, TokenInterceptor } from './shared/services/interceptor.service';


export const appConfig: ApplicationConfig = {
  providers: [
    AuthGuard,
    AdminSubdomainGuard,
    provideRouter(routes, 
      withRouterConfig({onSameUrlNavigation: 'reload'}),
      withInMemoryScrolling({scrollPositionRestoration: 'disabled', anchorScrolling: 'disabled'}),
      withPreloading(PreloadAllModules)
    ), 
    provideClientHydration(),
    provideHttpClient(
      withFetch(),
      withInterceptorsFromDi()
    ),
    { provide: HTTP_INTERCEPTORS, useClass: TokenInterceptor, multi: true},
    { provide: HTTP_INTERCEPTORS, useClass: HttpErrorInterceptor, multi: true},
    provideImgixLoader(`https://${environment.IMGIX_DOMAIN}`),
  ]
};

