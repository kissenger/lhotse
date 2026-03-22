import { TestBed } from '@angular/core/testing';
import { ScrollspyService } from './scrollspy.service';

describe('ScrollspyService', () => {
  let service: ScrollspyService;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [ScrollspyService] });
    service = TestBed.inject(ScrollspyService);
  });

  afterEach(() => {
    document.querySelectorAll('[data-scrollspy-anchor]').forEach((element) => element.remove());
  });

  it('intersectHandler should emit the visible anchor closest to the fixed header', (done) => {
    spyOn(window, 'requestAnimationFrame').and.callFake((callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    });

    Object.defineProperty(window, 'innerHeight', { value: 900, configurable: true });
    document.documentElement.style.setProperty('--header-height', '75px');

    const homeAnchor = document.createElement('div');
    homeAnchor.id = 'home';
    homeAnchor.className = 'anchor';
    homeAnchor.setAttribute('data-scrollspy-anchor', '');
    spyOn(homeAnchor, 'getBoundingClientRect').and.returnValue({
      top: -300,
      bottom: 220,
      height: 520,
    } as DOMRect);
    document.body.appendChild(homeAnchor);

    const blogAnchor = document.createElement('div');
    blogAnchor.id = 'blog';
    blogAnchor.className = 'anchor';
    blogAnchor.setAttribute('data-scrollspy-anchor', '');
    spyOn(blogAnchor, 'getBoundingClientRect').and.returnValue({
      top: 70,
      bottom: 680,
      height: 610,
    } as DOMRect);
    document.body.appendChild(blogAnchor);

    service.intersectionEmitter.subscribe((payload) => {
      expect(payload.id).toBe('blog');
      done();
    });

    service.observeChildren({} as any);
  });

  it('intersectHandler should prefer the next visible anchor when it is closest to the header', (done) => {
    spyOn(window, 'requestAnimationFrame').and.callFake((callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    });

    Object.defineProperty(window, 'innerHeight', { value: 900, configurable: true });
    document.documentElement.style.setProperty('--header-height', '75px');

    const blogAnchor = document.createElement('div');
    blogAnchor.id = 'blog';
    blogAnchor.className = 'anchor';
    blogAnchor.setAttribute('data-scrollspy-anchor', '');
    spyOn(blogAnchor, 'getBoundingClientRect').and.returnValue({
      top: 120,
      bottom: 700,
      height: 580,
    } as DOMRect);
    document.body.appendChild(blogAnchor);

    const bookAnchor = document.createElement('div');
    bookAnchor.id = 'snorkelling-britain';
    bookAnchor.className = 'anchor';
    bookAnchor.setAttribute('data-scrollspy-anchor', '');
    spyOn(bookAnchor, 'getBoundingClientRect').and.returnValue({
      top: 420,
      bottom: 980,
      height: 560,
    } as DOMRect);
    document.body.appendChild(bookAnchor);

    service.intersectionEmitter.subscribe((payload) => {
      expect(payload.id).toBe('blog');
      done();
    });

    service.observeChildren({} as any);
  });
});
