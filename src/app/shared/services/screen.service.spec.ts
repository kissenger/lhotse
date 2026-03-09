import { TestBed } from '@angular/core/testing';
import { ScreenService } from './screen.service';
import { ViewportRuler } from '@angular/cdk/scrolling';

describe('ScreenService', () => {
  let service: ScreenService;

  beforeEach(() => {
    const mockViewport = {
      getViewportSize: () => ({ width: 1024, height: 800 }),
      change: () => ({ subscribe: () => ({ unsubscribe: () => {} }) })
    };
    TestBed.configureTestingModule({ providers: [{ provide: ViewportRuler, useValue: mockViewport }, ScreenService] });
    service = TestBed.inject(ScreenService);
  });

  it('initializes widthDescriptor and deviceOrientation', () => {
    expect(service.widthDescriptor).toBeDefined();
    expect(service.deviceOrientation).toBeDefined();
  });
});
