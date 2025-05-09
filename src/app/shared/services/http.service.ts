
import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { environment } from '@environments/environment';
import { BlogPost, OrderStatus, OrderSummary } from '@shared/types';
import { PayPalCreateOrder } from '@shared/types';
import { catchError, lastValueFrom, NEVER, Observable, throwError } from 'rxjs';

@Injectable({
  providedIn: 'root',
})

export class HttpService {

  private _backendURL = `${environment.PROTOCOL}://${environment.BASE_URL}/${environment.BACKEND_SEGMENT}`;

  constructor(
    private http: HttpClient
  ) {}

  // getJSON(): Observable<any> {
  //   return this.http.get("@assets/codes.json")
  // }

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

  async getOrderByOrderNumber(orderNumber?: string) {
    const request = this.http.get<any>(`${this._backendURL}/shop/get-order-by-order-number/${orderNumber}`);
    return await lastValueFrom<any>(request);
  }

  // async createPaypalOrder(order: PayPalCreateOrder): Promise<any> {
  //   return this.http
  //     .post<any>(`${this._backendURL}/shop/create-paypal-order/`, order)
  //     // .pipe(catchError(error=>{throw new Error(error)}))
  //     .subscribe( (res) => {return res} )
  //     // 
  //   // return await lastValueFrom<any>(request);
  // }

  async createPaypalOrder(orderNumber: string | null, order: PayPalCreateOrder): Promise<any> {
    const request = this.http.post<any>(`${this._backendURL}/shop/create-paypal-order/`, {orderNumber, order});
    return await lastValueFrom<any>(request);
    // .subscribe( (res) => {return res} )
  }

  async logPaypalError(orderNumber: string, error: object): Promise<any> {
    const request = this.http.post<any>(`${this._backendURL}/shop/log-paypal-error/`, {orderNumber, error});
    return await lastValueFrom<any>(request);
  }

  async capturePaypalPayment(orderNumber: string, paypalOrderId: string): Promise<any> {
    const request = this.http.post<any>(`${this._backendURL}/shop/capture-paypal-payment/`, {orderNumber, paypalOrderId});
    return await lastValueFrom<any>(request);
  }

  async patchPaypalOrder(orderNumber: string, paypalOrderId: string, path: string, patch: object): Promise<any> {
    const request = this.http.post<any>(`${this._backendURL}/shop/patch-paypal-order/`, {orderNumber, paypalOrderId, path, patch});
    return await lastValueFrom<any>(request);
  }

  async upsertManualOrder(order: OrderSummary) {
    const request = this.http.post<any>(`${this._backendURL}/shop/upsert-manual-order/`, {order});
    return await lastValueFrom<any>(request);
  }

  /*
  SHOP ENDPOINTS
  */
  
  async getOrders(online: boolean, manual: boolean, test: boolean, status: string, text: string) {
    const request = this.http.get<any>(`${this._backendURL}/shop/get-orders/${online}/${manual}/${test}/${status||'null'}/${text||'null'}`);
    return await lastValueFrom<any>(request);
  }    

  async setTimestamp(orderNumber: string, set: OrderStatus) {
    const request = this.http.post(`${this._backendURL}/shop/set-order-status`, {orderNumber, set});
    return await lastValueFrom<any>(request);
  }    
  async unsetTimestamp(orderNumber: string, unset: OrderStatus) {
    const request = this.http.post(`${this._backendURL}/shop/unset-order-status`, {orderNumber, unset});
    return await lastValueFrom<any>(request);
  }   
  async addNote(orderNumber: string, note: string) {
    const request = this.http.post(`${this._backendURL}/shop/add-note`, {orderNumber, note});
    return await lastValueFrom<any>(request);
  }  
  async sendPostedEmail(orderNumber?: string) {
    const request = this.http.post(`${this._backendURL}/shop/send-posted-email`, {orderNumber});
    return await lastValueFrom<any>(request);
  }    

  async deactivateOrder(orderNumber: string) {
    const request = this.http.post<any>(`${this._backendURL}/shop/deactivate-order/`, {orderNumber});
    return await lastValueFrom<any>(request);
  }
  
}
