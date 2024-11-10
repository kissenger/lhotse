import { ApplicationConfig } from '@angular/core';
import { provideRouter, withInMemoryScrolling } from '@angular/router';
import { routes } from './app.routes';
import { provideClientHydration } from '@angular/platform-browser';
import { provideHttpClient, withFetch } from '@angular/common/http';
import { provideImgixLoader } from '@angular/common';
import { environment } from '@environments/environment';


export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes, 
      // withDebugTracing(),
      withInMemoryScrolling({ 
        scrollPositionRestoration: 'enabled',
        anchorScrolling: 'enabled'
      }),
    ), 
    provideClientHydration(),
    provideHttpClient(withFetch()),
    provideImgixLoader(`https://${environment.IMGIX_DOMAIN}`),
  ]
};


