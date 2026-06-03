import { TestBed } from '@angular/core/testing';
import { ArticleEditorComponent } from './article-editor.component';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { ActivatedRoute } from '@angular/router';
import { ArticlePost } from '@shared/types';
import { HttpService } from '@shared/services/http.service';
import { ToastService } from '@shared/services/toast.service';

describe('ArticleEditorComponent', () => {
  let comp: ArticleEditorComponent;
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ArticleEditorComponent, HttpClientTestingModule, RouterTestingModule],
      providers: [
        { provide: ActivatedRoute, useValue: { snapshot: { params: {} }, paramMap: { get: () => null } } },
        { provide: ToastService, useValue: { show: () => {} } }
      ]
    }).compileComponents();
    const f = TestBed.createComponent(ArticleEditorComponent);
    comp = f.componentInstance;
  });

  it('creates article-editor component', () => {
    expect(comp).toBeTruthy();
  });

  it('derives article section options only from existing posts', () => {
    comp.refreshPostList([]);
    expect(comp.articleSectionOptions).toEqual([]);

    const post = new ArticlePost();
    post.articleSection = 'Science and Nature';
    comp.refreshPostList([post]);

    expect(comp.articleSectionOptions).toEqual([
      'Science and Nature'
    ]);
  });

  it('stores new article sections exactly as entered', () => {
    comp.newArticleSectionLabel = 'Snorkelling Gear';

    comp.addArticleSection();

    expect(comp.selectedPost.articleSection).toBe('Snorkelling Gear');
    expect(comp.articleSectionOptions).toEqual(['Snorkelling Gear']);
  });

  it('sends preserveUpdatedAt for section-only saves', async () => {
    const existingPost = new ArticlePost();
    existingPost._id = '1';
    existingPost.slug = 'existing-post';
    existingPost.title = 'Existing Post';
    existingPost.subtitle = 'Subtitle';
    existingPost.intro = 'Intro';
    existingPost.imgFname = 'photos/example.jpg';
    existingPost.imgAlt = 'Alt';
    existingPost.conclusion = 'Conclusion';
    existingPost.articleSection = 'News';
    existingPost.createdAt = '2026-01-01T00:00:00.000Z';
    existingPost.updatedAt = '2026-01-02T00:00:00.000Z';

    comp.refreshPostList([existingPost]);
    comp.onFormSelect(existingPost.slug);
    comp.selectedPost.articleSection = 'Snorkelling Gear';

    const upsertSpy = spyOn(TestBed.inject(HttpService), 'upsertPost').and.returnValue(Promise.resolve([
      { ...existingPost, articleSection: 'Snorkelling Gear' } as ArticlePost
    ]));

    await comp.onSave();

    expect(upsertSpy).toHaveBeenCalledWith(jasmine.objectContaining({ articleSection: 'Snorkelling Gear' }), { preserveUpdatedAt: true });
  });
});
