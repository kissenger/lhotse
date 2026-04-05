import { TestBed } from '@angular/core/testing';
import { PostShowerComponent } from './post-shower.component';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpService } from '@shared/services/http.service';
import { PLATFORM_ID } from '@angular/core';
import { Subject } from 'rxjs';
import { BlogPost } from '@shared/types';

function makeArticle(overrides: Partial<BlogPost> = {}): BlogPost {
  const p = new BlogPost();
  Object.assign(p, {
    slug: 'test-slug',
    title: 'Test Post',
    intro: 'Hello world',
    conclusion: 'Goodbye',
    sections: [],
    likes: 5,
    publishedAt: '2023-01-01T00:00:00.000Z',
    updatedAt:   '2023-01-15T00:00:00.000Z',
    imgFname: '',
    ...overrides
  });
  return p;
}

function buildComp(platform = 'browser') {
  const params$ = new Subject<any>();
  const mockRoute = {
    params: params$.asObservable(),
    snapshot: {
      params: { slug: 'test-slug' },
      queryParamMap: { has: () => false }
    }
  };
  const mockHttp = {
    getPostBySlug: jasmine.createSpy('getPostBySlug').and.returnValue(Promise.resolve({ article: makeArticle() })),
    getLastAndNextSlugs: jasmine.createSpy('getLastAndNextSlugs').and.returnValue(Promise.resolve({ nextSlug: 'next', lastSlug: 'last', nextTitle: 'Next', lastTitle: 'Last' })),
    likePost: jasmine.createSpy('likePost').and.returnValue(Promise.resolve({ likes: 6 }))
  };
  const mockRouter = { url: '/blog/test-slug', navigateByUrl: jasmine.createSpy('navigateByUrl') };

  TestBed.configureTestingModule({
    imports: [PostShowerComponent, HttpClientTestingModule],
    providers: [
      { provide: ActivatedRoute, useValue: mockRoute },
      { provide: Router, useValue: mockRouter },
      { provide: HttpService, useValue: mockHttp },
      { provide: PLATFORM_ID, useValue: platform }
    ]
  });

  const f = TestBed.createComponent(PostShowerComponent);
  return { comp: f.componentInstance, params$, mockHttp, mockRouter };
}

describe('PostShowerComponent', () => {

  afterEach(() => TestBed.resetTestingModule());

  it('creates post shower', () => {
    const { comp } = buildComp();
    expect(comp).toBeTruthy();
  });

  it('initial loadingState is loading', () => {
    const { comp } = buildComp();
    expect(comp.loadingState).toBe('loading');
  });

  it('ngOnInit does nothing on server platform', () => {
    const { comp, mockHttp } = buildComp('server');
    comp.ngOnInit();
    expect(mockHttp.getPostBySlug).not.toHaveBeenCalled();
  });

  // --- success path ---

  it('sets loadingState to success after loading post', async () => {
    const { comp, params$ } = buildComp();
    comp.ngOnInit();
    params$.next({ slug: 'test-slug' });
    await new Promise(r => setTimeout(r, 50));
    expect(comp.loadingState).toBe('success');
  });

  it('populates post data after success', async () => {
    const { comp, params$ } = buildComp();
    comp.ngOnInit();
    params$.next({ slug: 'test-slug' });
    await new Promise(r => setTimeout(r, 50));
    expect(comp.post.title).toBe('Test Post');
    expect(comp.nextSlug).toBe('next');
    expect(comp.lastSlug).toBe('last');
  });

  it('showUpdatedAt is false when published and updated in same month', async () => {
    const { comp, params$, mockHttp } = buildComp();
    const article = makeArticle({ publishedAt: '2023-02-10T00:00:00.000Z', updatedAt: '2023-02-28T00:00:00.000Z' });
    mockHttp.getPostBySlug.and.returnValue(Promise.resolve({ article }));
    comp.ngOnInit();
    params$.next({ slug: 'test-slug' });
    await new Promise(r => setTimeout(r, 50));
    expect(comp.showUpdatedAt).toBe(false);
  });

  it('showUpdatedAt is true when updated in a different month', async () => {
    const { comp, params$, mockHttp } = buildComp();
    const article = makeArticle({ publishedAt: '2023-01-01T00:00:00.000Z', updatedAt: '2023-04-01T00:00:00.000Z' });
    mockHttp.getPostBySlug.and.returnValue(Promise.resolve({ article }));
    comp.ngOnInit();
    params$.next({ slug: 'test-slug' });
    await new Promise(r => setTimeout(r, 50));
    expect(comp.showUpdatedAt).toBe(true);
  });

  it('redirects to 404 when API returns no article', async () => {
    const { comp, params$, mockHttp, mockRouter } = buildComp();
    mockHttp.getPostBySlug.and.returnValue(Promise.resolve({ article: null }));
    comp.ngOnInit();
    params$.next({ slug: 'test-slug' });
    await new Promise(r => setTimeout(r, 50));
    expect(mockRouter.navigateByUrl).toHaveBeenCalled();
  });

  // --- error path ---

  it('sets loadingState to failed on network error', async () => {
    const { comp, params$, mockHttp } = buildComp();
    mockHttp.getPostBySlug.and.returnValue(Promise.reject(new Error('Network error')));
    comp.ngOnInit();
    params$.next({ slug: 'test-slug' });
    await new Promise(r => setTimeout(r, 50));
    expect(comp.loadingState).toBe('failed');
  });

  // --- onHeroImageLoaded ---

  it('onHeroImageLoaded sets contentVisible to true', () => {
    const { comp } = buildComp();
    expect(comp.contentVisible).toBe(false);
    comp.onHeroImageLoaded();
    expect(comp.contentVisible).toBe(true);
  });

  // --- onRetry ---

  it('onRetry resets state back to loading then to success', async () => {
    const { comp } = buildComp();
    comp.loadingState = 'failed';
    comp.onRetry();  // void — does not return a promise
    await new Promise(r => setTimeout(r, 50));
    expect(comp.loadingState).toBe('success');
  });

  it('onRetry resets contentVisible before fetching', () => {
    const { comp, mockHttp } = buildComp();
    comp.contentVisible = true;
    mockHttp.getPostBySlug.and.returnValue(new Promise(() => {})); // never resolves
    comp.onRetry();
    expect(comp.contentVisible).toBe(false);
  });

  // --- onLike ---

  it('onLike increments likeCount and sets hasLiked', async () => {
    const { comp } = buildComp();
    comp.likeCount = 5;
    comp.hasLiked = false;
    comp.post.slug = 'test-slug';
    await comp.onLike();
    expect(comp.likeCount).toBe(6);
    expect(comp.hasLiked).toBe(true);
  });

  it('onLike does nothing when already liked', async () => {
    const { comp, mockHttp } = buildComp();
    comp.hasLiked = true;
    await comp.onLike();
    expect(mockHttp.likePost).not.toHaveBeenCalled();
  });

  // --- ngOnDestroy ---

  it('ngOnDestroy unsubscribes route subscription', () => {
    const { comp } = buildComp();
    comp.ngOnInit();
    const spy = jasmine.createSpy('unsubscribe');
    (comp as any)._routeSubs = { unsubscribe: spy };
    comp.ngOnDestroy();
    expect(spy).toHaveBeenCalled();
  });
});
