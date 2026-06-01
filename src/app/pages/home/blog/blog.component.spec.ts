import { TestBed } from '@angular/core/testing';
import { BlogComponent } from './blog.component';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { ActivatedRoute } from '@angular/router';
import { BlogPost } from '@shared/types';
import { HttpService } from '@shared/services/http.service';
import { PLATFORM_ID } from '@angular/core';

function makePost(sectionTitle = '', title = '', subtitle = ''): BlogPost {
  const p = new BlogPost();
  p.blogSection = sectionTitle;
  p.title = title;
  p.subtitle = subtitle;
  p.slug = title.toLowerCase().replace(/\s+/g, '-');
  return p;
}

describe('BlogComponent', () => {
  let comp: BlogComponent;
  let mockHttp: jasmine.SpyObj<Pick<HttpService, 'getPublishedPosts'>>;

  beforeEach(async () => {
    mockHttp = jasmine.createSpyObj('HttpService', ['getPublishedPosts']);
    mockHttp.getPublishedPosts.and.returnValue(Promise.resolve([]));

    await TestBed.configureTestingModule({
      imports: [BlogComponent, HttpClientTestingModule, RouterTestingModule],
      providers: [
        { provide: ActivatedRoute, useValue: { snapshot: { params: {} }, paramMap: { get: () => null } } },
        { provide: HttpService, useValue: mockHttp },
        { provide: PLATFORM_ID, useValue: 'server' }  // skip ngOnInit HTTP call
      ]
    }).compileComponents();
    const f = TestBed.createComponent(BlogComponent);
    comp = f.componentInstance;
  });

  afterEach(() => TestBed.resetTestingModule());

  it('creates blog component', () => {
    expect(comp).toBeTruthy();
  });

  // --- grouping ---

  it('groups posts into configured categories in order', () => {
    const posts = [
      makePost('Snorkelling Sites', 'Best bay for beginners'),
      makePost('News', 'Project update'),
      makePost('Reviews', 'Mask review'),
      makePost('Science and Nature', 'Sea slugs and habitat'),
      makePost('British Snorkelling', 'How to start snorkelling')
    ];

    const grouped = (comp as any)._groupPosts(posts);
    expect(grouped.map((g: any) => g.slug)).toEqual([
      'snorkelling-sites',
      'news',
      'product-reviews',
      'science-and-nature',
      'british-snorkelling'
    ]);
    expect(grouped[0].posts.length).toBe(1);
    expect(grouped[1].posts.length).toBe(1);
    expect(grouped[2].posts.length).toBe(1);
    expect(grouped[3].posts.length).toBe(1);
    expect(grouped[4].posts.length).toBe(1);
  });

  it('keeps custom sections grouped by the exact stored title', () => {
    const post = makePost('Snorkelling Gear', 'Weekend snorkel notes');
    const grouped = (comp as any)._groupPosts([post]);
    const customSection = grouped.find((section: any) => section.title === 'Snorkelling Gear');

    expect(customSection).toEqual(jasmine.objectContaining({
      title: 'Snorkelling Gear',
      slug: 'snorkelling-gear'
    }));
  });

  it('contentsSections excludes empty categories', () => {
    comp.groupedPosts = [
      { title: 'News', slug: 'news', description: 'x', posts: [makePost('News', 'n')] },
      { title: 'Reviews', slug: 'product-reviews', description: 'y', posts: [] }
    ];
    expect(comp.contentsSections.length).toBe(1);
    expect(comp.contentsSections[0].slug).toBe('news');
  });

});
