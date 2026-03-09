
import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { AuthUser, BlogPost, OrderStatus, OrderSummary } from '@shared/types';
import { PayPalCreateOrder } from '@shared/types';
import { lastValueFrom} from 'rxjs';

@Injectable({providedIn: 'root'})

export class HttpService {

  private _http = inject(HttpClient);

  /*
  MAP 
  */
  async getSites(siteVisibility: Array<string>) {
    const request =  this._http.get<Array<BlogPost>>(`/api/sites/get-sites/${siteVisibility.join("/")}`)
    return await lastValueFrom(request);
  }

  /*
  BLOG 
  */
  async getAllPosts() {
    const request =  this._http.get<Array<BlogPost>>(`/api/blog/get-all-posts/`);
    return await lastValueFrom(request);
  }

  async getPublishedPosts() {
    const request =  this._http.get<Array<BlogPost>>(`/api/blog/get-published-posts/`);
    return await lastValueFrom(request);
  }

  async getPostBySlug(slug: string) {
    const request =  this._http.get<{article: BlogPost}>(`/api/blog/get-post-by-slug/${slug}`);
    return await lastValueFrom(request);
  }

  async getLastAndNextSlugs(slug: string) {
    const request =  this._http.get<{lastSlug: string, nextSlug: string}>(`/api/blog/get-last-and-next-slugs/${slug}`);
    return await lastValueFrom(request);
  }

  async getAllSlugs() {
    const request =  this._http.get<Array<string>>(`/api/blog/get-all-slugs/`);
    return await lastValueFrom(request);
  }

  async upsertPost(post: BlogPost) {
    const request = this._http.post<Array<BlogPost>>(`/api/blog/upsert-post/`, post);
    return await lastValueFrom(request);
  }
  
  async deletePost(postId: string) {
    const request =  this._http.get<Array<BlogPost>>(`/api/blog/delete-post/${postId}`);
    return await lastValueFrom(request);
  }

  /* 
  PAYPAL
  */

  async getOrderByOrderNumber(orderNumber?: string) {
    const request = this._http.get<any>(`/api/shop/get-order-by-order-number/${orderNumber}`);
    return await lastValueFrom(request);
  }

  async createPaypalOrder(orderNumber: string | null, order: PayPalCreateOrder): Promise<any> {
    const request = this._http.post<any>(`/api/shop/create-paypal-order/`, {orderNumber, order});
    return await lastValueFrom(request);
  }

  async logPaypalError(orderNumber: string, error: object): Promise<any> {
    const request = this._http.post<any>(`/api/shop/log-paypal-error/`, {orderNumber, error});
    return await lastValueFrom(request);
  }

  async capturePaypalPayment(orderNumber: string, paypalOrderId: string): Promise<any> {
    const request = this._http.post<any>(`/api/shop/capture-paypal-payment/`, {orderNumber, paypalOrderId});
    return await lastValueFrom(request);
  }

  async patchPaypalOrder(orderNumber: string, paypalOrderId: string, path: string, patch: object): Promise<any> {
    const request = this._http.post<any>(`/api/shop/patch-paypal-order/`, {orderNumber, paypalOrderId, path, patch});
    return await lastValueFrom(request);
  }

  async upsertManualOrder(order: OrderSummary) {
    const request = this._http.post<any>(`/api/shop/upsert-manual-order/`, {order});
    return await lastValueFrom(request);
  }
  
  async getOrders(online: boolean, manual: boolean, test: boolean, status: string, text: string) {
    const request = this._http.get<any>(`/api/shop/get-orders/${online}/${manual}/${test}/${status||'null'}/${text||'null'}`);
    return await lastValueFrom(request);
  }    

  async setTimestamp(orderNumber: string, set: OrderStatus) {
    const request = this._http.post(`/api/shop/set-order-status`, {orderNumber, set});
    return await lastValueFrom(request);
  }    

  async unsetTimestamp(orderNumber: string, unset: OrderStatus) {
    const request = this._http.post(`/api/shop/unset-order-status`, {orderNumber, unset});
    return await lastValueFrom(request);
  }   

  async addNote(orderNumber: string, note: string) {
    const request = this._http.post(`/api/shop/add-note`, {orderNumber, note});
    return await lastValueFrom(request);
  } 

  async sendPostedEmail(orderNumber?: string) {
    const request = this._http.post(`/api/shop/send-posted-email`, {orderNumber});
    return await lastValueFrom(request);
  }    

  async deactivateOrder(orderNumber: string) {
    const request = this._http.post<any>(`/api/shop/deactivate-order/`, {orderNumber});
    return await lastValueFrom(request);
  }

  // Auth

  async login(user: AuthUser) {
    const request = this._http.post<any>(`/api/auth/login/`, {user});
    return await lastValueFrom(request);
  }

  async register(user: AuthUser) {
    const request = this._http.post<any>(`/api/auth/register/`, {user});
    return await lastValueFrom(request);
  }
}
