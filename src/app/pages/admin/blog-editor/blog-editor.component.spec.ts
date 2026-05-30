import { TestBed } from '@angular/core/testing';
import { BlogEditorComponent } from './blog-editor.component';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { ActivatedRoute } from '@angular/router';
import { BlogPost } from '@shared/types';
import { HttpService } from '@shared/services/http.service';

describe('BlogEditorComponent', () => {
  let comp: BlogEditorComponent;
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BlogEditorComponent, HttpClientTestingModule, RouterTestingModule],
      providers: [{ provide: ActivatedRoute, useValue: { snapshot: { params: {} }, paramMap: { get: () => null } } }]
    }).compileComponents();
    const f = TestBed.createComponent(BlogEditorComponent);
    comp = f.componentInstance;
  });

  it('creates blog-editor component', () => {
    expect(comp).toBeTruthy();
  });

  it('derives blog section options only from existing posts', () => {
    comp.refreshPostList([]);
    expect(comp.blogSectionOptions).toEqual([]);

    const post = new BlogPost();
    post.blogSection = 'Science and Nature';
    comp.refreshPostList([post]);

    expect(comp.blogSectionOptions).toEqual([
      'Science and Nature'
    ]);
  });

  it('stores new blog sections exactly as entered', () => {
    comp.newBlogSectionLabel = 'Snorkelling Gear';

    comp.addBlogSection();

    expect(comp.selectedPost.blogSection).toBe('Snorkelling Gear');
    expect(comp.blogSectionOptions).toEqual(['Snorkelling Gear']);
  });

  it('sends preserveUpdatedAt for section-only saves', async () => {
    const existingPost = new BlogPost();
    existingPost._id = '1';
    existingPost.slug = 'existing-post';
    existingPost.title = 'Existing Post';
    existingPost.subtitle = 'Subtitle';
    existingPost.intro = 'Intro';
    existingPost.imgFname = 'photos/example.jpg';
    existingPost.imgAlt = 'Alt';
    existingPost.conclusion = 'Conclusion';
    existingPost.blogSection = 'News';
    existingPost.createdAt = '2026-01-01T00:00:00.000Z';
    existingPost.updatedAt = '2026-01-02T00:00:00.000Z';

    comp.refreshPostList([existingPost]);
    comp.onFormSelect(existingPost.slug);
    comp.selectedPost.blogSection = 'Snorkelling Gear';

    const upsertSpy = spyOn(TestBed.inject(HttpService), 'upsertPost').and.returnValue(Promise.resolve([
      { ...existingPost, blogSection: 'Snorkelling Gear' } as BlogPost
    ]));

    await comp.onSave();

    expect(upsertSpy).toHaveBeenCalledWith(jasmine.objectContaining({ blogSection: 'Snorkelling Gear' }), { preserveUpdatedAt: true });
  });
});
