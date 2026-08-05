import { TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { HttpService } from '@shared/services/http.service';
import { ToastService } from '@shared/services/toast.service';
import { ShopSettingsComponent } from './shop-settings.component';

describe('ShopSettingsComponent', () => {
  let comp: ShopSettingsComponent;
  let httpService: jasmine.SpyObj<HttpService>;
  let toastService: jasmine.SpyObj<ToastService>;

  beforeEach(async () => {
    httpService = jasmine.createSpyObj<HttpService>('HttpService', ['getAdminShopSettings', 'saveAdminShopSettings']);
    httpService.getAdminShopSettings.and.resolveTo({ active: false, message: '', endDate: null, rawMessage: '', rawEndDate: null });
    toastService = jasmine.createSpyObj<ToastService>('ToastService', ['show']);

    await TestBed.configureTestingModule({
      imports: [ShopSettingsComponent, HttpClientTestingModule, RouterTestingModule],
      providers: [
        { provide: ActivatedRoute, useValue: { snapshot: { params: {} }, paramMap: { get: () => null } } },
        { provide: HttpService, useValue: httpService },
        { provide: ToastService, useValue: toastService }
      ]
    }).compileComponents();

    comp = TestBed.createComponent(ShopSettingsComponent).componentInstance;
  });

  it('creates shop settings component', () => {
    expect(comp).toBeTruthy();
  });

  it('saveShopSettings warns when a message is missing an end date', async () => {
    comp.outOfOfficeMessage = 'Away until next week';
    comp.outOfOfficeEndDate = '';

    await comp.saveShopSettings();

    expect(httpService.saveAdminShopSettings).not.toHaveBeenCalled();
    expect(toastService.show).toHaveBeenCalledWith('Add an end date before saving the message', 'warning');
  });
});