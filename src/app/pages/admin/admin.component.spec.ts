import { TestBed } from '@angular/core/testing';
import { AdminComponent } from './admin.component';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { ActivatedRoute } from '@angular/router';

describe('AdminComponent', () => {
  let comp: AdminComponent;
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminComponent, HttpClientTestingModule, RouterTestingModule],
      providers: [{ provide: ActivatedRoute, useValue: { snapshot: { params: {} }, paramMap: { get: () => null } } }]
    }).compileComponents();
    const f = TestBed.createComponent(AdminComponent);
    comp = f.componentInstance;
  });

  it('creates admin component', () => {
    expect(comp).toBeTruthy();
  });
});
