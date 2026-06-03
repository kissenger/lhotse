import { TestBed } from '@angular/core/testing';
import { OrderOutcomeComponent } from './order-outcome.component';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { ActivatedRoute } from '@angular/router';

describe('OrderOutcomeComponent', () => {
  let comp: OrderOutcomeComponent;
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [OrderOutcomeComponent, HttpClientTestingModule, RouterTestingModule],
      providers: [{ provide: ActivatedRoute, useValue: { snapshot: { params: {} }, paramMap: { get: () => null } } }]
    }).compileComponents();
    const f = TestBed.createComponent(OrderOutcomeComponent);
    comp = f.componentInstance;
  });

  it('creates order outcome component', () => {
    expect(comp).toBeTruthy();
  });
});
