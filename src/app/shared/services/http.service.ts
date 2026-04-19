
import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { AuthUser, BlogPost, MapFeature, OrgCollectionKey, OrgDocument, OrgListResponse, OrgSettings, OrderStatus, OrderSummary } from '@shared/types';
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

  async getAllSitesAdmin() {
    const request = this._http.get<Array<MapFeature>>(`/api/sites/get-all-sites-admin/`);
    return await lastValueFrom(request);
  }

  async upsertSite(site: MapFeature) {
    const request = this._http.post<Array<MapFeature>>(`/api/sites/upsert-site/`, site);
    return await lastValueFrom(request);
  }

  async deleteSite(siteId: string) {
    const request = this._http.get<Array<MapFeature>>(`/api/sites/delete-site/${siteId}`);
    return await lastValueFrom(request);
  }

  /*
  BLOG 
  */
  private _publishedPostsCache: Array<BlogPost> | null = null;

  async getAllPosts() {
    const request =  this._http.get<Array<BlogPost>>(`/api/blog/get-all-posts/`);
    return await lastValueFrom(request);
  }

  async getPublishedPosts(bustCache = false) {
    if (!bustCache && this._publishedPostsCache) {
      return this._publishedPostsCache;
    }
    const request =  this._http.get<Array<BlogPost>>(`/api/blog/get-published-posts/`);
    this._publishedPostsCache = await lastValueFrom(request);
    return this._publishedPostsCache;
  }

  async getPostBySlug(slug: string, preview = false) {
    const path = preview
      ? `/api/blog/get-post-preview-by-slug/${slug}`
      : `/api/blog/get-post-by-slug/${slug}`;
    const request = this._http.get<{article: BlogPost}>(path, { withCredentials: preview });
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

  async likePost(slug: string): Promise<{ likes: number, alreadyLiked: boolean }> {
    const request = this._http.post<{ likes: number, alreadyLiked: boolean }>(`/api/blog/like/${slug}`, {});
    return await lastValueFrom(request);
  }

  async getLikes(slugs: string[]): Promise<Record<string, number>> {
    const request = this._http.post<Record<string, number>>(`/api/blog/get-likes`, { slugs });
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
    const request = this._http.post<{success: boolean}>(`/api/auth/login/`, {user}, { withCredentials: true });
    return await lastValueFrom(request);
  }

  async logout() {
    const request = this._http.post<{success: boolean}>(`/api/auth/logout/`, {}, { withCredentials: true });
    return await lastValueFrom(request);
  }

  async register(user: AuthUser) {
    const request = this._http.post<any>(`/api/auth/register/`, {user});
    return await lastValueFrom(request);
  }

  // Organisations

  async listOrgDocs(collection: OrgCollectionKey, search = '', skip = 0, limit = 100): Promise<OrgListResponse> {
    const params = new URLSearchParams({ search, skip: String(skip), limit: String(limit) });
    const request = this._http.get<OrgListResponse>(`/api/organisations/${collection}?${params}`, { withCredentials: true });
    return await lastValueFrom(request);
  }

  async getOrgDoc(collection: OrgCollectionKey, id: string): Promise<OrgDocument> {
    const request = this._http.get<OrgDocument>(`/api/organisations/${collection}/${id}`, { withCredentials: true });
    return await lastValueFrom(request);
  }

  async saveOrgDoc(collection: OrgCollectionKey, id: string, data: OrgDocument): Promise<OrgDocument> {
    const request = this._http.post<OrgDocument>(`/api/organisations/${collection}/${id}`, data, { withCredentials: true });
    return await lastValueFrom(request);
  }

  async deleteOrgDoc(collection: OrgCollectionKey, id: string): Promise<void> {
    const request = this._http.delete<void>(`/api/organisations/${collection}/${id}`, { withCredentials: true });
    return await lastValueFrom(request);
  }

  async getOrgSettings(): Promise<OrgSettings> {
    const request = this._http.get<OrgSettings>('/api/organisations/settings', { withCredentials: true });
    return await lastValueFrom(request);
  }

  async saveOrgSettings(settings: OrgSettings): Promise<OrgSettings> {
    const request = this._http.post<OrgSettings>('/api/organisations/settings', settings, { withCredentials: true });
    return await lastValueFrom(request);
  }
}

