import { TestBed } from '@angular/core/testing';
import { ShopComponent } from './shop.component';
import { ShopService } from '@shared/services/shop.service';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { ActivatedRoute } from '@angular/router';
import { HttpService } from '@shared/services/http.service';
import { ToastService } from '@shared/services/toast.service';

/** Minimal basket stub mirroring the real Basket API used by ShopComponent */
function makeBasketItem(id: string, name: string, value: number, alt: string) {
  return {
    id,
    name,
    description: 'Desc',
    quantity: 0,
    purchase_note: '',
    images: [{ src: `${id}.png`, alt }],
    unit_amount: { currency_code: 'GBP', value },
    dimensions: { thickness: 1, width: 1, length: 1 },
    weightInGrams: 100
  };
}

function makeBasket() {
  const _items: Array<any> = [
    makeBasketItem('0001', 'Book One', 10, 'Book one'),
    makeBasketItem('0002', 'Book Two', 12, 'Book two'),
    makeBasketItem('0003', 'Merch', 8, 'Merch')
  ];
  let _discountCode = '';
  let _discountPercent = 0;
  return {
    get items() { return _items; },
    get itemQty() { return _items.reduce((s, i) => s + i.quantity, 0); },
    get selectedShippingService() { return 'Royal Mail Tracked 48'; },
    get shippingCost() { return 3.5; },
    get discountValue() { return -1; },
    get totalCost() {
      return _items.reduce((sum, item) => sum + item.quantity * item.unit_amount.value, 0) + this.shippingCost + this.discountValue;
    },
    get discountCode() { return _discountCode; },
    set discountCode(v: string) { _discountCode = v; },
    get discountPercent() { return _discountPercent; },
    set discountPercent(v: number) { _discountPercent = v; },
    add(item: any, qty: number) { _items.push({ id: item.id ?? item, quantity: qty }); },
    incrementQty(id: string, inc: number) {
      const item = _items.find(i => i.id === id);
      if (item) item.quantity = Math.max(0, item.quantity + inc);
    }
  };
}

describe('ShopComponent', () => {
  let comp: ShopComponent;
  let basket: ReturnType<typeof makeBasket>;
  let httpService: jasmine.SpyObj<HttpService>;
  let fixture: any;

  beforeEach(async () => {
    basket = makeBasket();
    httpService = jasmine.createSpyObj<HttpService>('HttpService', ['getPublicShopSettings']);
    httpService.getPublicShopSettings.and.resolveTo({ active: false, message: '', endDate: null });
    const mockShop = {
      basket,
      items: [],
      orderStatus: 'draft',
      reset: jasmine.createSpy('reset'),
      initializeDefaultBasket: jasmine.createSpy('initializeDefaultBasket'),
      item: (id: string) => ({ id, name: 'Test Item', price: 10 })
    } as any;

    await TestBed.configureTestingModule({
      imports: [ShopComponent, HttpClientTestingModule, RouterTestingModule],
      providers: [
        { provide: ShopService, useValue: mockShop },
        { provide: HttpService, useValue: httpService },
        { provide: ToastService, useValue: { show: () => {} } },
        { provide: ActivatedRoute, useValue: { snapshot: { params: {} }, paramMap: { get: () => null } } }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(ShopComponent);
    comp = fixture.componentInstance;
  });

  afterEach(() => TestBed.resetTestingModule());

  it('creates shop component', () => {
    expect(comp).toBeTruthy();
  });

  it('refreshShopSettings applies the active warning and blocks checkout until acknowledged', async () => {
    httpService.getPublicShopSettings.and.resolveTo({
      active: true,
      message: 'Orders may be delayed while we are away.',
      endDate: '2099-01-01'
    });

    await comp.refreshShopSettings();

    expect(comp.checkoutNotice.active).toBeTrue();
    expect(comp.checkoutNotice.message).toContain('delayed');
    expect(comp.checkoutBlocked).toBeTrue();
  });

  it('acknowledgeOutOfOffice enables checkout for the latest warning', async () => {
    basket.items.find(i => i.id === '0003')!.quantity = 1;
    httpService.getPublicShopSettings.and.resolveTo({
      active: true,
      message: 'Dispatch resumes next week.',
      endDate: '2099-01-01'
    });
    spyOn<any>(comp, '_initPayPal').and.returnValue(Promise.resolve());

    await comp.refreshShopSettings();
    await comp.acknowledgeOutOfOffice();

    expect(comp.checkoutWarningActive).toBeFalse();
    expect(comp.checkoutBlocked).toBeFalse();
    expect((comp as any)._initPayPal).toHaveBeenCalled();
  });

  it('keeps the out of office notice visible after acknowledgement', async () => {
    basket.items.find(i => i.id === '0003')!.quantity = 1;
    httpService.getPublicShopSettings.and.resolveTo({
      active: true,
      message: 'Dispatch resumes next week.',
      endDate: '2099-01-01'
    });
    spyOn<any>(comp, '_initPayPal').and.returnValue(Promise.resolve());

    await comp.refreshShopSettings();
    await comp.acknowledgeOutOfOffice();
    fixture.detectChanges();

    const warning = fixture.nativeElement.querySelector('.checkout-warning');
    expect(warning?.textContent).toContain('Dispatch resumes next week.');
    expect(warning?.textContent).not.toContain('I understand');
  });

  // --- bookQty ---

  it('bookQty sums quantities of book items (0001 and 0002)', () => {
    const b1 = basket.items.find(i => i.id === '0001')!;
    const b2 = basket.items.find(i => i.id === '0002')!;
    b1.quantity = 2;
    b2.quantity = 1;
    expect(comp.bookQty).toBe(3);
  });

  it('bookQty excludes non-book items', () => {
    basket.items.forEach(i => { i.quantity = 0; });
    const nonBook = basket.items.find(i => i.id === '0003')!;
    nonBook.quantity = 5;
    expect(comp.bookQty).toBe(0);
  });

  // --- onPlusMinus ---

  it('onPlusMinus calls basket.incrementQty with correct args', () => {
    (comp as any)._paypalInitialized = true; // prevent template re-render from PayPal init
    const spy = spyOn(basket, 'incrementQty').and.callThrough();
    comp.onPlusMinus('0003', 1);
    expect(spy).toHaveBeenCalledWith('0003', 1);
  });

  it('onPlusMinus blocks increment when bookQty >= 4 for a book item', () => {
    const b1 = basket.items.find(i => i.id === '0001')!;
    b1.quantity = 4;
    const spy = spyOn(basket, 'incrementQty');
    comp.onPlusMinus('0001', 1);
    expect(spy).not.toHaveBeenCalled();
  });

  it('onPlusMinus allows increment when bookQty is 3 for a book item', () => {
    basket.items.forEach(i => { i.quantity = 0; });
    basket.items.find(i => i.id === '0001')!.quantity = 3;
    (comp as any)._paypalInitialized = true;
    const spy = spyOn(basket, 'incrementQty').and.callThrough();
    comp.onPlusMinus('0001', 1);
    expect(spy).toHaveBeenCalledWith('0001', 1);
  });

  it('onPlusMinus allows increment for non-book items regardless of bookQty', () => {
    basket.items.filter(i => ['0001', '0002'].includes(i.id)).forEach(i => { i.quantity = 4; });
    (comp as any)._paypalInitialized = true;
    const spy = spyOn(basket, 'incrementQty').and.callThrough();
    comp.onPlusMinus('0003', 1);
    expect(spy).toHaveBeenCalled();
  });

  it('onPlusMinus resets _paypalInitialized when basket becomes empty', () => {
    basket.items.forEach(i => { i.quantity = 0; });
    basket.items.find(i => i.id === '0003')!.quantity = 1;
    (comp as any)._paypalInitialized = true;
    comp.onPlusMinus('0003', -1);
    expect((comp as any)._paypalInitialized).toBe(false);
  });

  // --- onCodeChange ---

  it('onCodeChange sets dirtyDiscountCode to true', () => {
    basket.discountCode = '';
    comp.onCodeChange();
    expect(comp.dirtyDiscountCode).toBe(true);
  });

  it('onCodeChange sets discountPercent for a matching code', () => {
    comp.discountCodes = [{ code: 'snorkel10', discount: 10 }];
    basket.discountCode = 'SNORKEL10';
    comp.onCodeChange();
    expect(basket.discountPercent).toBe(10);
  });

  it('onCodeChange sets discountPercent to 0 for unrecognised code', () => {
    comp.discountCodes = [{ code: 'snorkel10', discount: 10 }];
    basket.discountCode = 'WRONGCODE';
    basket.discountPercent = 10;
    comp.onCodeChange();
    expect(basket.discountPercent).toBe(0);
  });

  // --- ngOnDestroy ---

  it('ngOnDestroy disconnects the summary intersection observer', () => {
    const mockObserver = { disconnect: jasmine.createSpy('disconnect') };
    (comp as any)._summaryObserver = mockObserver;
    comp.ngOnDestroy();
    expect(mockObserver.disconnect).toHaveBeenCalled();
  });
});
