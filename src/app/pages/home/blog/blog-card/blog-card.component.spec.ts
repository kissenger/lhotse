import { TestBed } from '@angular/core/testing';
import { BlogCardComponent } from './blog-card.component';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { ActivatedRoute } from '@angular/router';

describe('BlogCardComponent', () => {
  let comp: BlogCardComponent;
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BlogCardComponent, HttpClientTestingModule, RouterTestingModule],
      providers: [{ provide: ActivatedRoute, useValue: { snapshot: { params: {} }, paramMap: { get: () => null } } }]
    }).compileComponents();
    const f = TestBed.createComponent(BlogCardComponent);
    comp = f.componentInstance;
  });

  it('creates blog card', () => {
    expect(comp).toBeTruthy();
  });
});
