import { TestBed } from '@angular/core/testing';
import { PostShowerComponent } from './post-shower.component';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { ActivatedRoute } from '@angular/router';

describe('PostShowerComponent', () => {
  let comp: PostShowerComponent;
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PostShowerComponent, HttpClientTestingModule, RouterTestingModule],
      providers: [{ provide: ActivatedRoute, useValue: { snapshot: { params: {} }, paramMap: { get: () => null } } }]
    }).compileComponents();
    const f = TestBed.createComponent(PostShowerComponent);
    comp = f.componentInstance;
  });

  it('creates post shower', () => {
    expect(comp).toBeTruthy();
  });
});
