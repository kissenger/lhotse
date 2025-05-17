import { Injectable } from '@angular/core';
import { HttpService } from './http.service';

@Injectable({
  providedIn: 'root',
})

export class AuthService {

  private MAX_AGE = 60 * 60 * 24 * 365 * 10;  // 31 days
  private COOKIE_NAME_TOKEN = '__sn_token';

  constructor(
  ) {}
  
  public set token(token: any) {
    document.cookie = `${this.COOKIE_NAME_TOKEN}=${JSON.stringify(token)}; max-age=${this.MAX_AGE}; path=/`;
  }

  public get isLoggedIn() {
    // check that the token is decodeable and has username property
    return !!this.token;
  }

  public get token() {
    try {
      return JSON.parse(this._fetchCookie(this.COOKIE_NAME_TOKEN)!);
    } catch {
      return null;
    }
  }

  public decodeToken(token: any) {
    var base64Url = token.split('.')[1];
    var base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    var jsonPayload = decodeURIComponent(window.atob(base64).split('').map(function(c) {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));
    return JSON.parse(jsonPayload);
  }

  private _fetchCookie(cookieName: string) {
    return document.cookie?.split('; ').find(row => row.startsWith(cookieName))?.split('=')[1];
  }

  private _deleteCookie(cookieName: string) {
    document.cookie = `${cookieName}=; path=/`;
  }

  public deleteCookies() {
    this._deleteCookie(this.COOKIE_NAME_TOKEN);
  }

}
