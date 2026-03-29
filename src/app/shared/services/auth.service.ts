import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root',
})

export class AuthService {

  private COOKIE_NAME_SESSION = '__sn_session';

  constructor() {}

  public get isLoggedIn() {
    return !!this._fetchCookie(this.COOKIE_NAME_SESSION);
  }

  private _fetchCookie(cookieName: string) {
    return document.cookie?.split('; ').find(row => row.startsWith(cookieName + '='))?.split('=').slice(1).join('=');
  }

  /**
   * Clears the client-readable presence cookie.
   * Call after the server logout endpoint has cleared the HttpOnly token cookie.
   */
  public deleteCookies() {
    document.cookie = `${this.COOKIE_NAME_SESSION}=; path=/; max-age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
  }

}
