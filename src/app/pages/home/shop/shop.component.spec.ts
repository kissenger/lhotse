import { TestBed } from '@angular/core/testing';
import { ShopComponent } from './shop.component';
import { ShopService } from '@shared/services/shop.service';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { ActivatedRoute } from '@angular/router';

describe('ShopComponent', () => {
  let comp: ShopComponent;

  beforeEach(async () => {
    const mockBasket = {
      items: [],
      add: (_item: any, _qty: number) => {},
      remove: (_id: string) => {}
    };
    const mockShop = {
      items: [],
      basket: mockBasket,
      reset: () => {},
      item: (id: string) => ({ id: id, name: 'Test Item', price: 10 })
    } as any;
    await TestBed.configureTestingModule({
      imports: [ShopComponent, HttpClientTestingModule, RouterTestingModule],
      providers: [
        { provide: ShopService, useValue: mockShop },
        { provide: ActivatedRoute, useValue: { snapshot: { params: {} }, paramMap: { get: () => null } } }
      ]
    }).compileComponents();
    const f = TestBed.createComponent(ShopComponent);
    comp = f.componentInstance;
  });

  it('creates shop component', () => {
    expect(comp).toBeTruthy();
  });
});
