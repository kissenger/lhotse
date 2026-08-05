import { TestBed } from '@angular/core/testing';
import { OrdersComponent } from './orders.component';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { ActivatedRoute } from '@angular/router';
import { HttpService } from '@shared/services/http.service';
import { ExportFileService } from '@shared/services/export.service';
import { ToastService } from '@shared/services/toast.service';

describe('OrdersComponent', () => {
  let comp: OrdersComponent;
  let httpService: jasmine.SpyObj<HttpService>;

  beforeEach(async () => {
    httpService = jasmine.createSpyObj<HttpService>('HttpService', ['getOrders']);
    httpService.getOrders.and.resolveTo([] as any);

    await TestBed.configureTestingModule({
      imports: [OrdersComponent, HttpClientTestingModule, RouterTestingModule],
      providers: [
        { provide: ActivatedRoute, useValue: { snapshot: { params: {} }, paramMap: { get: () => null } } },
        { provide: HttpService, useValue: httpService },
        { provide: ExportFileService, useValue: { createCSV: () => {} } },
        { provide: ToastService, useValue: { show: () => {} } }
      ]
    }).compileComponents();
    const f = TestBed.createComponent(OrdersComponent);
    comp = f.componentInstance;
  });

  it('creates orders component', () => {
    expect(comp).toBeTruthy();
  });
});
