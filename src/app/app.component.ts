import { Component, OnInit, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { PagesComponent } from './pages/pages.component';
import { ScrollOffsetService } from '@shared/services/scroll-offset.service';

@Component({
  standalone: true,
  imports: [PagesComponent],
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent implements OnInit {
  private _router = inject(Router);
  private _platformId = inject(PLATFORM_ID);
  private _scrollOffset = inject(ScrollOffsetService);

  private _scrollToFragment(fragment: string, behavior: ScrollBehavior = 'smooth') {
    const el = document.getElementById(fragment);
    if (!el) {
      return;
    }

    const top = el.getBoundingClientRect().top + window.scrollY - this._scrollOffset.getFragmentOffset();
    window.scrollTo({ top: Math.max(top, 0), left: 0, behavior });
  }

  ngOnInit() {
    if (!isPlatformBrowser(this._platformId)) return;

    this._router.events
      .pipe(filter(e => e instanceof NavigationEnd))
      .subscribe((e: any) => {
        const fragment = this._router.parseUrl(e.urlAfterRedirects).fragment;
        if (fragment) {
          // Delay scroll to allow @defer blocks to mount and stabilise layout
          setTimeout(() => {
            this._scrollToFragment(fragment, 'smooth');
          }, 150);
        } else {
          window.scrollTo({ top: 0, left: 0, behavior: 'instant' as ScrollBehavior });
        }
      });
  }
}
