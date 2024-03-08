import { Component, Injector, PLATFORM_ID} from '@angular/core';
import { createCustomElement } from '@angular/elements';
import { ExtLinkComponent } from './shared/components/ext-link/ext-link.component';
import { isPlatformBrowser } from '@angular/common';
import { HeaderComponent } from './shared/components/header/header.component';
import { FooterComponent } from './shared/components/footer/footer.component';
import { RouterOutlet } from '@angular/router';

@Component({
  standalone: true,
  imports: [HeaderComponent, FooterComponent, RouterOutlet],
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})

export class AppComponent {

  title = 'Snorkelology';

  constructor(
    private injector: Injector,
  ) {
    if (isPlatformBrowser(PLATFORM_ID)) {
      const el = createCustomElement(ExtLinkComponent, {injector});
      customElements.define('ext-link', el);
    }
  }
}

