import { TestBed } from '@angular/core/testing';
import { FAQComponent } from './faq.component';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { ActivatedRoute } from '@angular/router';

describe('FAQComponent', () => {
  let comp: FAQComponent;
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FAQComponent, HttpClientTestingModule, RouterTestingModule],
      providers: [{ provide: ActivatedRoute, useValue: { snapshot: { params: {} }, paramMap: { get: () => null } } }]
    }).compileComponents();
    const f = TestBed.createComponent(FAQComponent);
    comp = f.componentInstance;
  });

  it('creates faq component', () => {
    expect(comp).toBeTruthy();
  });
});
