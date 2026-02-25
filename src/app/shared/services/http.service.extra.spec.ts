import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { HttpService } from './http.service';
import { environment } from '@environments/environment';

describe('HttpService additional methods', () => {
  let service: HttpService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [HttpClientTestingModule], providers: [HttpService] });
    service = TestBed.inject(HttpService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('getPublishedPosts should GET published posts', async () => {
    const mock = [{ title: 'p' }];
    const p = service.getPublishedPosts();
    const req = httpMock.expectOne(`${environment.PROTOCOL}://${environment.BASE_URL}/${environment.BACKEND_SEGMENT}/blog/get-published-posts/`);
    expect(req.request.method).toBe('GET');
    req.flush(mock);
    const res = await p;
    expect(res).toEqual(mock);
  });

  it('getPostBySlug should GET post and return article', async () => {
    const slug = 'post-1';
    const mock = { article: { title: 'x' }, nextSlug: '', lastSlug: '' };
    const p = service.getPostBySlug(slug);
    const req = httpMock.expectOne(`${environment.PROTOCOL}://${environment.BASE_URL}/${environment.BACKEND_SEGMENT}/blog/get-post-by-slug/${slug}`);
    expect(req.request.method).toBe('GET');
    req.flush(mock);
    const res = await p;
    expect(res.article.title).toEqual('x');
  });

  it('createPaypalOrder and capturePaypalPayment should POST to backend', async () => {
    const order = { amount: 1 } as any;
    const create = service.createPaypalOrder(null, order);
    const req = httpMock.expectOne(`${environment.PROTOCOL}://${environment.BASE_URL}/${environment.BACKEND_SEGMENT}/shop/create-paypal-order/`);
    expect(req.request.method).toBe('POST');
    req.flush({ id: 'ok' });
    const res = await create;
    expect(res.id).toEqual('ok');

    const capture = service.capturePaypalPayment('ON', 'PAYID');
    const req2 = httpMock.expectOne(`${environment.PROTOCOL}://${environment.BASE_URL}/${environment.BACKEND_SEGMENT}/shop/capture-paypal-payment/`);
    expect(req2.request.method).toBe('POST');
    req2.flush({ status: 'captured' });
    const cres = await capture;
    expect(cres.status).toEqual('captured');
  });
});
