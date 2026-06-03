import { TestBed } from '@angular/core/testing';
import { ArticleCardComponent } from './article-card.component';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { ActivatedRoute } from '@angular/router';
import { ArticlePost } from '@shared/types';

describe('ArticleCardComponent', () => {
  let comp: ArticleCardComponent;
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ArticleCardComponent, HttpClientTestingModule, RouterTestingModule],
      providers: [{ provide: ActivatedRoute, useValue: { snapshot: { params: {} }, paramMap: { get: () => null } } }]
    }).compileComponents();
    const f = TestBed.createComponent(ArticleCardComponent);
    comp = f.componentInstance;
  });

  it('creates article card', () => {
    expect(comp).toBeTruthy();
  });

  it('falls back to a local asset path after an image error', () => {
    const post = new ArticlePost();
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
