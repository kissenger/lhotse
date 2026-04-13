import { ApplicationConfig, Injectable } from '@angular/core';
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

@Injectable({ providedIn: 'root' })
export class SelectivePreloadingStrategy implements PreloadingStrategy {
  preload(route: Route, load: () => Observable<any>): Observable<any> {
    return route.data?.['noPreload'] ? of(null) : load();
  }
}

export const appConfig: ApplicationConfig = {
  providers: [
    AuthGuard,
    AdminSubdomainGuard,
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
        const src = config.src.replace(/^\//, '');
        if (environment.STAGE === 'dev') {
          return `/assets/${src}`;
        }
        const domain = environment.IMGIX_DOMAIN.replace(/\/$/, '');
        const base = `https://${domain}/${src}`;
        const w = config.width ? `&w=${config.width}` : '';
        // fm=webp: explicit WebP output supports alpha (unlike JPEG, which caused
        // 422 when imgix had no Accept header during SSR and fell back to JPEG).
        return `${base}?fm=webp&fit=max${w}`;
      }
    },
  ]
};

