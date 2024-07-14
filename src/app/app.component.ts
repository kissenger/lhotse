import { Component, Injector, PLATFORM_ID, Inject} from '@angular/core';
import { createCustomElement } from '@angular/elements';
import { ExtLinkComponent } from './shared/components/ext-link/ext-link.component';
import { isPlatformBrowser } from '@angular/common';
import { HeaderComponent } from './shared/components/header/header.component';
import { FooterComponent } from './shared/components/footer/footer.component';
import { Router, RouterOutlet, NavigationEnd, ActivatedRoute } from '@angular/router';
import { filter, map, mergeMap } from 'rxjs/operators'
import { DOCUMENT } from '@angular/common';
import { Meta, Title } from '@angular/platform-browser';
import { environment } from '@environments/environment';

@Component({
  standalone: true,
  imports: [HeaderComponent, FooterComponent, RouterOutlet],
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent {


  constructor(
    @Inject(DOCUMENT) private dom: any,
    private injector: Injector,
    private router: Router,
    private activatedRoute: ActivatedRoute,
    private meta: Meta,
    private title: Title
    
  ) {
    if (isPlatformBrowser(PLATFORM_ID)) {
      const el = createCustomElement(ExtLinkComponent, {injector});
      customElements.define('ext-link', el);
    }

    // get route data - not simple not sure i udnerstand it
    // source: https://stackoverflow.com/questions/43512695/how-to-get-route-data-into-app-component-in-angular-2
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd),
      map(() => this.activatedRoute),
      map(route => {
        while (route.firstChild) route = route.firstChild
        return route
      }),
      filter(route => route.outlet === 'primary'),
      mergeMap(route => route.data)
    ).subscribe(data => {

      // update index meta data, title and canonincal link for SEO
      let canonicalUrl = 'https://snorkelology.com' + this.router.url.toString();
      this.updateCanonicalUrl(canonicalUrl);
      this.title.setTitle(environment.ISBETA ? 'BETA - ' : '' + data['title']);
      let nkw = data['keywords'];
      if (nkw) {
        let kw = this.meta.getTag('name=keywords');
        if (kw) {
          nkw = kw.content + ', ' + nkw
        }
        this.meta.updateTag({name: 'keywords', content: nkw});
      }
    })
  }    

  // source: https://www.tektutorialshub.com/angular/angular-canonical-url/
  updateCanonicalUrl(url:string){
    const head = this.dom.getElementsByTagName('head')[0];
    var element: HTMLLinkElement= this.dom.querySelector(`link[rel='canonical']`) || null
    if (element==null) {
      element= this.dom.createElement('link') as HTMLLinkElement;
      head.appendChild(element);
    }
    element.setAttribute('rel','canonical')
    element.setAttribute('href',url)
  }
}

