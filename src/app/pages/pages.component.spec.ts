import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PagesComponent } from './pages.component';
import { ToastService } from '@shared/services/toast.service';
import { ActivatedRoute, Router } from '@angular/router';
import { DOCUMENT } from '@angular/common';

class MockToastService {
  init() {}
}

const mockActivatedRoute = {};
const mockRouter = { events: { pipe: () => ({ subscribe: () => {} }) } } as any;
const mockScrollspy = { intersectionEmitter: { subscribe: () => ({ unsubscribe() {} }) } };
const mockScreen = { widthDescriptor: 'large' };

describe('PagesComponent', () => {
  let fixture: ComponentFixture<PagesComponent>;
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PagesComponent],
      providers: [
        { provide: ToastService, useClass: MockToastService },
        { provide: ActivatedRoute, useValue: mockActivatedRoute },
        { provide: Router, useValue: mockRouter },
        { provide: 'ScrollspyService', useValue: mockScrollspy },
        { provide: 'ScreenService', useValue: mockScreen },
        { provide: DOCUMENT, useValue: document }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(PagesComponent);
  });

  it('should create pages component', () => {
    const comp = fixture.componentInstance;
    expect(comp).toBeTruthy();
  });
});
