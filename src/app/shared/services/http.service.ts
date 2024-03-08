
import { Injectable } from '@angular/core';
import { HttpClient} from '@angular/common/http';
import { environment } from '@environments/environment';

@Injectable({
  providedIn: 'root',
})

export class HttpService {

  private _backendURL = `${environment.PROTOCOL}://${environment.BACKEND_URL}`;

  constructor(
    private http: HttpClient
    ) {
  }

  getInstaPosts() {
    return this.http
      .get<any>(`https://graph.instagram.com/v18.0/me/media?fields=media_url,media_type,caption,timestamp,permalink&access_token=${environment.INSTA_TESTER_TOKEN}`)
  }

  storeEmail(contact: {email: string}) {
    return this.http.post<any>(`${this._backendURL}/store-email/`, contact);
  }

}
