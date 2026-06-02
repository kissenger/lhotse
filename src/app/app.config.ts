import { ApplicationConfig, Injectable, provideZoneChangeDetection } from '@angular/core';
import { provideRouter, withInMemoryScrolling, withRouterConfig, withPreloading, PreloadingStrategy, Route } from '@angular/router';
import { Observable, of } from 'rxjs';
import { routes } from './app.routes';
import { provideClientHydration } from '@angular/platform-browser';
import { HTTP_INTERCEPTORS, provideHttpClient, withFetch, withInterceptorsFromDi } from '@angular/common/http';
import { IMAGE_LOADER, ImageLoaderConfig } from '@angular/common';
import { environment } from '@environments/environment';
import { AuthGuard } from './auth.guard';
import { AdminSubdomainGuard } from './admin-subdomain.guard';
import { HttpErrorInterceptor, TokenInterceptor } from './shared/services/interceptor.service';
import { appImageUrl } from './shared/utils/image-url';

@Injectable({ providedIn: 'root' })
class SelectivePreloadingStrategy implements PreloadingStrategy {
  preload(route: Route, load: () => Observable<any>): Observable<any> {
    // Opt-in preloading only: routes preload only when explicitly flagged.
    return route.data?.['preload'] ? load() : of(null);
  }
}

export const appConfig: ApplicationConfig = {
  providers: [
    AuthGuard,
    AdminSubdomainGuard,
    provideZoneChangeDetection({ eventCoalescing: true, runCoalescing: true }),
    provideRouter(routes, 
      withRouterConfig({onSameUrlNavigation: 'reload'}),
      withInMemoryScrolling({scrollPositionRestoration: 'disabled', anchorScrolling: 'disabled'}),
      withPreloading(SelectivePreloadingStrategy)
    ), 
    provideClientHydration(),
    provideHttpClient(
      withFetch(),
      withInterceptorsFromDi()
    ),
    { provide: HTTP_INTERCEPTORS, useClass: TokenInterceptor, multi: true},
    { provide: HTTP_INTERCEPTORS, useClass: HttpErrorInterceptor, multi: true},
    {
      provide: IMAGE_LOADER,
      useValue: (config: ImageLoaderConfig) => {
        return appImageUrl(config.src, {
          stage: environment.STAGE,
          width: config.width,
          format: 'webp',
          fit: 'contain',
          quality: 40,
        });
      }
    },
  ]
};

