import { Injectable } from '@angular/core';
import { HttpService } from './http.service';
import { AuthUser } from '../types';

@Injectable({
  providedIn: 'root',
})

export class AuthService {

  private MAX_AGE = 60 * 60 * 24 * 365 * 10;  // 31 days
  private COOKIE_NAME_USER = '__sn_user';
  private COOKIE_NAME_TOKEN = '__sn_token';

  constructor(
    private http: HttpService
  ) {}


  // public get isLoggedIn() {
  //   return !!this.token;
  // }

  public get isGuest() {
    return !!(this.user.userName === 'guest');
  }

  // public get isRegistered() {
  //   return this.isLoggedIn && !this.isGuest;
  // }


  public set user(user: AuthUser) {
    document.cookie = `${this.COOKIE_NAME_USER}=${JSON.stringify(user)}; max-age=${this.MAX_AGE}; path=/`;
  }

  public set guest(user: AuthUser) {
    document.cookie = `${this.COOKIE_NAME_USER}=${JSON.stringify(user)}; path=/`;
  }

  public set userToken(token: string) {
    document.cookie = `${this.COOKIE_NAME_TOKEN}=${JSON.stringify(token)}; max-age=${this.MAX_AGE}; path=/`;
  }

  public set guestToken(token: string) {
    document.cookie = `${this.COOKIE_NAME_TOKEN}=${JSON.stringify(token)}; path=/`;
  }

  // public get user() {
  //   try {
  //     return JSON.parse(this.fetchCookie(this.COOKIE_NAME_USER));
  //   } catch {
  //     return null;
  //   }
  // }

  // public get token() {
  //   try {
  //     return JSON.parse(this.fetchCookie(this.COOKIE_NAME_TOKEN));
  //   } catch {
  //     return null;
  //   }
  // }

  private fetchCookie(cookieName: string) {
    return document.cookie?.split('; ').find(row => row.startsWith(cookieName))?.split('=')[1];
  }

  private deleteCookie(cookieName: string) {
    document.cookie = `${cookieName}=; path=/`;
  }

  logout() {
    this.deleteCookie(this.COOKIE_NAME_USER);
    this.deleteCookie(this.COOKIE_NAME_TOKEN);
    // this.data.clearAll();
  }


  // login( userName: string, password: string ) {

  //   return new Promise<void>( (res, rej) => {

  //     this.http.login( {userName, password} ).subscribe( (result) => {

  //       if (result.user.userName === 'guest') {
  //         this.guest = result.user;
  //         this.guestToken = result.token;
  //       } else {
  //         this.user = result.user;
  //         this.userToken = result.token;
  //       }
  //       res();

  //     }, (error) => {

  //       rej(error);

  //     });
  //   });

  // }


  // register(user: TsUser) {

  //   return new Promise<void>( (res, rej) => {

  //     this.http.register(user).subscribe( (result) => {

  //       this.user = result.user;
  //       this.userToken = result.token;
  //       res();

  //     }, (error) => {

  //       rej(error);

  //     });

  //   });

  // }



}
