
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '@environments/environment';
import { AuthUser, BlogPost, OrderStatus, OrderSummary } from '@shared/types';
import { PayPalCreateOrder } from '@shared/types';
import { lastValueFrom} from 'rxjs';

@Injectable({
  providedIn: 'root',
})

export class HttpService {

  private _backendURL = `${environment.PROTOCOL}://${environment.BASE_URL}/${environment.BACKEND_SEGMENT}`;

  constructor(
    private http: HttpClient
  ) {}

  /*
  MAP 
  */
  async getSites(visibleOnly: boolean) {
    const request =  this.http.get<Array<BlogPost>>(`${this._backendURL}/sites/get-sites/${visibleOnly}`);
    return await lastValueFrom<any>(request);
  }

  /*
  BLOG 
  */
  async getAllPosts() {
    const request =  this.http.get<Array<BlogPost>>(`${this._backendURL}/blog/get-all-posts/`);
    return await lastValueFrom<any>(request);
  }

  async getPublishedPosts() {
    const request =  this.http.get<Array<BlogPost>>(`${this._backendURL}/blog/get-published-posts/`);
    return await lastValueFrom<any>(request);
  }

  async getPostBySlug(slug: string) {
    const request =  this.http.get<{article: BlogPost, nextSlug: string, lastSlug: string}>(`${this._backendURL}/blog/get-post-by-slug/${slug}`);
    return await lastValueFrom<any>(request);
  }

  async upsertPost(post: BlogPost) {
    const request = this.http.post<Array<BlogPost>>(`${this._backendURL}/blog/upsert-post/`, post);
    return await lastValueFrom<any>(request);
  }
  
  async deletePost(postId: string) {
    const request =  this.http.get<Array<BlogPost>>(`${this._backendURL}/blog/delete-post/${postId}`);
    return await lastValueFrom<any>(request);
  }

  /* 
  PAYPAL
  */

  async getOrderByOrderNumber(orderNumber?: string) {
    const request = this.http.get<any>(`${this._backendURL}/shop/get-order-by-order-number/${orderNumber}`);
    return await lastValueFrom<any>(request);
  }

  async createPaypalOrder(orderNumber: string | null, order: PayPalCreateOrder): Promise<any> {
    const request = this.http.post<any>(`${this._backendURL}/shop/create-paypal-order/`, {orderNumber, order});
    return await lastValueFrom<any>(request);
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

  // Auth

  async login(user: AuthUser) {
    const request = this.http.post<any>(`${this._backendURL}/auth/login/`, {user});
    return await lastValueFrom<any>(request);
  }

  async register(user: AuthUser) {
    const request = this.http.post<any>(`${this._backendURL}/auth/register/`, {user});
    return await lastValueFrom<any>(request);
  }
}
