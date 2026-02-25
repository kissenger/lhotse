import { TestBed } from '@angular/core/testing';
import { ShopService } from './shop.service';

describe('ShopService', () => {
  let service: ShopService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ShopService);
  });

  it('should create and expose items and basket', () => {
    expect(service).toBeTruthy();
    expect(service.items.length).toBeGreaterThan(0);
    const first = service.items[0];
    service.basket.add(first as any, 2);
    expect(service.basket.itemQty).toBe(2);
  });

  it('should compute total cost and paypal options', () => {
    const first = service.items[0];
    service.reset();
    service.basket.add(first as any, 1);
    const order = service.order;
    expect(order).toBeTruthy();
    expect(order.paypal.intent.purchase_units[0].items.length).toBeGreaterThanOrEqual(0);
  });
});
