import { TestBed } from '@angular/core/testing';
import { ScrollspyService } from './scrollspy.service';

describe('ScrollspyService', () => {
  let service: ScrollspyService;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [ScrollspyService] });
    service = TestBed.inject(ScrollspyService);
  });

  it('intersectHandler should emit events for entries', (done) => {
    service.intersectionEmitter.subscribe((payload) => {
      expect(payload.id).toBe('t');
      done();
    });
    const fakeEntry: any = { target: { id: 't', className: 'c' }, intersectionRatio: 0.3 };
    service.intersectHandler([fakeEntry]);
  });
});
