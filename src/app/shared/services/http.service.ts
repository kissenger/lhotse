
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '@environments/environment';
import { BlogPost } from '@shared/types';
import { PaypalOrder } from './shop.service';

@Injectable({
  providedIn: 'root',
})

export class HttpService {

  private _backendURL = `${environment.PROTOCOL}://${environment.BASE_URL}/${environment.BACKEND_SEGMENT}`;

  constructor(
    private http: HttpClient
    ) {}

  /*
  BLOG POSTS ENDPOINTS
  */
  getAllPosts() {
    return this.http.get<Array<BlogPost>>(`${this._backendURL}/blog/get-all-posts/`);
  }

  getPublishedPosts() {
    return this.http.get<Array<BlogPost>>(`${this._backendURL}/blog/get-published-posts/`);
  }

  getPostBySlug(slug: string) {
    return this.http.get<{article: BlogPost, nextSlug: string, lastSlug: string}>(`${this._backendURL}/blog/get-post-by-slug/${slug}`);
  }

  upsertPost(post: BlogPost) {
    return this.http.post<Array<BlogPost>>(`${this._backendURL}/blog/upsert-post/`, post);
  }
  
  deletePost(postId: string) {
    return this.http.get<Array<BlogPost>>(`${this._backendURL}/blog/delete-post/${postId}`);
  }

  /* 
  PAYPAL ENDPOINTS
  */
  createPaypalOrder(order: PaypalOrder) {
    return this.http.post<any>(`${this._backendURL}/shop/create-paypal-order/`, order);
  }

  completePaypalOrder(orderId: string) {
    const payload = {
      'intent': 'capture',
      'order_id': orderId 
    }
    return this.http.post<any>(`${this._backendURL}/shop/complete-paypal-order/`, payload).toPromise;
  }

}
