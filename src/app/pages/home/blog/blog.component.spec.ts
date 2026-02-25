import { TestBed } from '@angular/core/testing';
import { BlogComponent } from './blog.component';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { ActivatedRoute } from '@angular/router';

describe('BlogComponent', () => {
  let comp: BlogComponent;
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BlogComponent, HttpClientTestingModule, RouterTestingModule],
      providers: [{ provide: ActivatedRoute, useValue: { snapshot: { params: {} }, paramMap: { get: () => null } } }]
    }).compileComponents();
    const f = TestBed.createComponent(BlogComponent);
    comp = f.componentInstance;
  });

  it('creates blog component', () => {
    expect(comp).toBeTruthy();
  });
});
