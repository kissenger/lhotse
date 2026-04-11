import { Inject, Injectable, PLATFORM_ID } from '@angular/core';
import { DOCUMENT, isPlatformBrowser } from '@angular/common';

@Injectable({
  providedIn: 'root',
})

export class AuthService {

  private COOKIE_NAME_SESSION = '__sn_session';

  constructor(
    @Inject(DOCUMENT) private _document: Document,
    @Inject(PLATFORM_ID) private _platformId: object,
  ) {}

  public get isLoggedIn() {
    return !!this._fetchCookie(this.COOKIE_NAME_SESSION);
  }

  private _fetchCookie(cookieName: string) {
    if (!isPlatformBrowser(this._platformId)) return undefined;
    return this._document.cookie?.split('; ').find(row => row.startsWith(cookieName + '='))?.split('=').slice(1).join('=');
  }

  /**
   * Clears the client-readable presence cookie.
   * Call after the server logout endpoint has cleared the HttpOnly token cookie.
   */
  public deleteCookies() {
    if (!isPlatformBrowser(this._platformId)) return;
    this._document.cookie = `${this.COOKIE_NAME_SESSION}=; path=/; max-age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
  }

}
