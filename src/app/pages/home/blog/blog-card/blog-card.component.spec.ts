import { TestBed } from '@angular/core/testing';
import { BlogCardComponent } from './blog-card.component';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { ActivatedRoute } from '@angular/router';
import { BlogPost } from '@shared/types';

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

  it('falls back to a local asset path after an image error', () => {
    const post = new BlogPost();
    post.imgFname = 'photos/example.jpg';

    comp.data = post;
    comp.ngOnChanges({
      data: {
        currentValue: post,
        previousValue: null,
        firstChange: true,
        isFirstChange: () => true,
      }
    });

    expect(comp.imageSrc).toBeTruthy();

    comp.onImageError();

    expect(comp.imageSrc).toBe('/assets/photos/example.jpg');
  });
});
