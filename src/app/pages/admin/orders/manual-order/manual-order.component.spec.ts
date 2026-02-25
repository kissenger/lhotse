import { TestBed } from '@angular/core/testing';
import { ManualOrderComponent } from './manual-order.component';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { ActivatedRoute } from '@angular/router';

describe('ManualOrderComponent', () => {
  let comp: ManualOrderComponent;
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ManualOrderComponent, HttpClientTestingModule, RouterTestingModule],
      providers: [{ provide: ActivatedRoute, useValue: { snapshot: { params: {} }, paramMap: { get: () => null } } }]
    }).compileComponents();
    const f = TestBed.createComponent(ManualOrderComponent);
    comp = f.componentInstance;
  });

  it('creates manual-order component', () => {
    expect(comp).toBeTruthy();
  });
});

