import { Component, Injector, PLATFORM_ID} from '@angular/core';
import { createCustomElement } from '@angular/elements';
import { isPlatformBrowser } from '@angular/common';
import { HeaderComponent } from '@shared/components/header/header.component';
import { FooterComponent } from '@shared/components/footer/footer.component';
import { RouterOutlet } from '@angular/router';
import { ExternalLinkComponent } from '@shared/components/external-link/external-link.component';

@Component({
  standalone: true,
  imports: [HeaderComponent, FooterComponent, RouterOutlet],
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent {


  constructor(
    private injector: Injector
    
  ) {
    if (isPlatformBrowser(PLATFORM_ID)) {
      const el = createCustomElement(ExternalLinkComponent, {injector});
      customElements.define('ext-link', el);
    }
  }

}
