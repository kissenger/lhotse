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

  afterEach(() => {
    httpMock.verify();
  });

  it('getAllPosts should call backend and return data', async () => {
    const mock = [{ title: 'a' }];
    const p = service.getAllPosts();
    const expectedUrl = `${environment.PROTOCOL}://${environment.BASE_URL}/${environment.BACKEND_SEGMENT}/blog/get-all-posts/`;
    const req = httpMock.expectOne(expectedUrl);
    expect(req.request.method).toBe('GET');
    req.flush(mock);
    const res = await p;
    expect(res).toEqual(mock);
  });
});
