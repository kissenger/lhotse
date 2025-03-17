
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '@environments/environment';
import { BlogPost, OrderStatus } from '@shared/types';
import { PayPalCaptureOrder, PayPalCreateOrder, PayPalOrderError } from './shop.service';
import { lastValueFrom } from 'rxjs';

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
  async createPaypalOrder(order: PayPalCreateOrder): Promise<any> {
    const request = this.http.post<any>(`${this._backendURL}/shop/create-paypal-order/`, order);
    return await lastValueFrom<any>(request);
  }

  async logPaypalError(orderNumber: string, error: object): Promise<any> {
    const request = this.http.post<any>(`${this._backendURL}/shop/log-paypal-error/`, {orderNumber, error});
    return await lastValueFrom<any>(request);
  }

  async capturePaypalPayment(orderNumber: string): Promise<any> {
    console.log(orderNumber);
    const request = this.http.post<any>(`${this._backendURL}/shop/capture-paypal-payment/`, {orderNumber});
    return await lastValueFrom<any>(request);
  }

  /*
  SHOP ENDPOINTS
  */
  // newOrder(orderIntent: PayPalCreateOrder) {
  //   return this.http.post(`${this._backendURL}/shop/new-order`, orderIntent);
  // }
  // updateOrderApproved(orderId: string, orderApproved: PayPalCaptureOrder) {
  //   return this.http.post(`${this._backendURL}/shop/`, {orderId, orderApproved});
  // }  
  // updateOrderError(orderId: string, orderError: PayPalOrderError) {
  //   return this.http.post(`${this._backendURL}/shop/new-order`, {orderId, orderError});
  // }    
  getOrders() {
    return this.http.get(`${this._backendURL}/shop/get-orders`);
  }    
  setOrderStatus(orderNumber: string, orderStatus: OrderStatus) {
    return this.http.post(`${this._backendURL}/shop/set-order-status`, {orderNumber, orderStatus});
  }    
}
