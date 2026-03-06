import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { HttpService } from './http.service';
import { environment } from '@environments/environment';

describe('HttpService', () => {
  let service: HttpService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [HttpService]
    });
    service = TestBed.inject(HttpService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  it('getPublishedPosts should call backend and return data', async () => {
    const mock: any = [{ title: 'b' }];
    const p = service.getPublishedPosts();
    const expectedUrl = `/api/blog/get-published-posts/`;
    const req = httpMock.expectOne(expectedUrl);
    expect(req.request.method).toBe('GET');
    req.flush(mock);
    const res = await p;
    expect(res).toEqual(mock);
  });

  it('getPostBySlug should call backend and return data', async () => {
    const mock: any = { article: { title: 'c' }, nextSlug: 'n', lastSlug: 'l' };
    const p = service.getPostBySlug('slug');
    const expectedUrl = `/api/blog/get-post-by-slug/slug`;
    const req = httpMock.expectOne(expectedUrl);
    expect(req.request.method).toBe('GET');
    req.flush(mock);
    const res = await p;
    expect(res).toEqual(mock);
  });

  it('getAllSlugs should call backend and return data', async () => {
    const mock = ['a','b'];
    const p = service.getAllSlugs();
    const expectedUrl = `/api/blog/get-all-slugs/`;
    const req = httpMock.expectOne(expectedUrl);
    expect(req.request.method).toBe('GET');
    req.flush(mock);
    const res = await p;
    expect(res).toEqual(mock);
  });

  it('upsertPost should call backend and return data', async () => {
    const mock: any = [{ title: 'd' }];
    const p = service.upsertPost({ title: 'd' } as any);
    const expectedUrl = `/api/blog/upsert-post/`;
    const req = httpMock.expectOne(expectedUrl);
    expect(req.request.method).toBe('POST');
    req.flush(mock);
    const res = await p;
    expect(res).toEqual(mock);
  });

  it('deletePost should call backend and return data', async () => {
    const mock: any = [{ title: 'e' }];
    const p = service.deletePost('id');
    const expectedUrl = `/api/blog/delete-post/id`;
    const req = httpMock.expectOne(expectedUrl);
    expect(req.request.method).toBe('GET');
    req.flush(mock);
    const res = await p;
    expect(res).toEqual(mock);
  });

  afterEach(() => {
    httpMock.verify();
  });

  // Additional tests from http.service.extra.spec.ts
  it('getPublishedPosts should GET published posts (extra)', async () => {
    const mock: any = [{ title: 'p' }];
    const p = service.getPublishedPosts();
    const req = httpMock.expectOne(`/api/blog/get-published-posts/`);
    expect(req.request.method).toBe('GET');
    req.flush(mock);
    const res = await p;
    expect(res).toEqual(mock);
  });

  it('getPostBySlug should GET post and return article (extra)', async () => {
    const slug = 'post-1';
    const mock: any = { article: { title: 'x' }, nextSlug: '', lastSlug: '' };
    const p = service.getPostBySlug(slug);
    const req = httpMock.expectOne(`/api/blog/get-post-by-slug/${slug}`);
    expect(req.request.method).toBe('GET');
    req.flush(mock);
    const res = await p;
    expect(res.article.title).toEqual('x');
  });

  it('createPaypalOrder and capturePaypalPayment should POST to backend', async () => {
    const order = { amount: 1 } as any;
    const create = service.createPaypalOrder(null, order);
    const req = httpMock.expectOne(`/api/shop/create-paypal-order/`);
    expect(req.request.method).toBe('POST');
    req.flush({ id: 'ok' });
    const res = await create;
    expect(res.id).toEqual('ok');

    const capture = service.capturePaypalPayment('ON', 'PAYID');
    const req2 = httpMock.expectOne(`/api/shop/capture-paypal-payment/`);
    expect(req2.request.method).toBe('POST');
    req2.flush({ status: 'captured' });
    const cres = await capture;
    expect(cres.status).toEqual('captured');
  });

  it('getAllPosts should call backend and return data', async () => {
    const mock: any = [{ title: 'a' }];
    const p = service.getAllPosts();
    const expectedUrl = `/api/blog/get-all-posts/`;
    const req = httpMock.expectOne(expectedUrl);
    expect(req.request.method).toBe('GET');
    req.flush(mock);
    const res = await p;
    expect(res).toEqual(mock);
  });
});
