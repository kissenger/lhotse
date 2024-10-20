
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '@environments/environment';
import { BlogPost } from '@shared/types';

@Injectable({
  providedIn: 'root',
})

export class HttpService {

  private _backendURL = `${environment.PROTOCOL}://${environment.BACKEND_URL}`;

  constructor(
    private http: HttpClient
    ) {
  }

  // getInstaPosts() {
  //   return this.http
  //     .get<any>(`https://graph.instagram.com/v18.0/me/media?fields=media_url,media_type,caption,timestamp,permalink&access_token=${environment.INSTA_TESTER_TOKEN}`)
  // }

  storeEmail(contact: {email: string}) {
    console.log(`${this._backendURL}/store-email/`)
    return this.http.post<any>(`${this._backendURL}/store-email/`, contact);
  }

  getAllPosts() {
    return this.http.get<Array<BlogPost>>(`${this._backendURL}/get-all-posts/`);
  }

  getPublishedPosts() {
    return this.http.get<Array<BlogPost>>(`${this._backendURL}/get-published-posts/`);
  }

  getPostBySlug(slug: string) {
    return this.http.get<BlogPost>(`${this._backendURL}/get-post-by-slug/${slug}`);
  }

  upsertPost(post: BlogPost) {
    return this.http.post<Array<BlogPost>>(`${this._backendURL}/upsert-post/`, post);
  }
  
  deletePost(postId: string) {
    return this.http.get<Array<BlogPost>>(`${this._backendURL}/delete-post/${postId}`);
  }

}
