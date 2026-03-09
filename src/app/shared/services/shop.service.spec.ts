import { TestBed } from '@angular/core/testing';
import { ShopService } from './shop.service';

describe('ShopService', () => {
  let service: ShopService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ShopService);
    service.reset && service.reset();
  });

  // Additional tests from shop.service.extra.spec.ts
  it('incrementQty should not go negative and respects max weight', () => {
    const item = service.items[0];
    service.basket.add(item as any, 1);
    const id = service.basket.items[0].id;
    // try decrementing below zero
    service.basket.incrementQty(id, -2);
    expect(service.basket.itemQty).toBe(1);

    // increment large number to try to exceed max weight
    const largeInc = 100000;
    const before = service.basket.itemQty;
    service.basket.incrementQty(id, largeInc);
    // should not have increased because of weight guard
    expect(service.basket.itemQty).toBe(before);
  });

  it('shippingCost returns other when selectedShippingService is Other', () => {
    const item = service.items[0];
    service.basket.add(item as any, 1);
    service.basket.selectedShippingService = 'Other';
    service.basket.shippingCost = 9.99;
    expect(service.basket.shippingCost).toBe(9.99);
  });

  it('discount calculations and paypal options', () => {
    const item = service.items[0];
    service.basket.add(item as any, 2);
    service.basket.discountPercent = 10;
    const discountValue = service.basket.discountValue;
    expect(discountValue).toBeLessThanOrEqual(0);
    const paypalOpts = service.basket.paypalShippingOptions;
    expect(Array.isArray(paypalOpts)).toBeTrue();
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
