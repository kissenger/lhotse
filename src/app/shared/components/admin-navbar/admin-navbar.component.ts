import { Component, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router, RouterLink, RouterLinkActive, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs';
import { AuthService } from '@shared/services/auth.service';
import { HttpService } from '@shared/services/http.service';

@Component({
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  selector: 'app-admin-navbar',
  templateUrl: './admin-navbar.component.html',
  styleUrl: './admin-navbar.component.css',
})
export class AdminNavbarComponent {

  isLoggedIn = false;

  readonly links = [
    { label: 'Dashboard',     path: '/dashboard' },
    { label: 'Blog',          path: '/blogeditor' },
    { label: 'Sites',         path: '/siteseditor' },
    { label: 'Map',           path: '/adminmap' },
    { label: 'Organisations', path: '/organisations' },
    { label: 'Orders',        path: '/orders' },
  ];

  constructor(
    private _auth: AuthService,
    private _http: HttpService,
    private _router: Router,
    @Inject(PLATFORM_ID) private _platformId: object,
  ) {
    if (isPlatformBrowser(this._platformId)) {
      this.isLoggedIn = this._auth.isLoggedIn;
      this._router.events.pipe(filter(e => e instanceof NavigationEnd)).subscribe(() => {
        this.isLoggedIn = this._auth.isLoggedIn;
      });
    }
  }

  async onLogout() {
    try { await this._http.logout(); } catch {}
    this._auth.deleteCookies();
    this._router.navigate(['/login']);
  }
}
