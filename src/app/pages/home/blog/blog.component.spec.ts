import { TestBed } from '@angular/core/testing';
import { BlogComponent } from './blog.component';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { ActivatedRoute } from '@angular/router';
import { BlogPost } from '@shared/types';
import { HttpService } from '@shared/services/http.service';
import { ScreenService } from '@shared/services/screen.service';
import { PLATFORM_ID } from '@angular/core';

function makePost(keywords: string[]): BlogPost {
  const p = new BlogPost();
  p.keywords = keywords;
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
        { provide: ScreenService, useValue: { width: 0, widthDescriptor: 'small' } },
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

  // --- getUniqueKeywords ---

  it('getUniqueKeywords extracts unique sorted keywords from allPosts', () => {
    comp.allPosts = [
      makePost(['snorkelling', 'gear']),
      makePost(['marine life', 'snorkelling'])
    ];
    comp.getUniqueKeywords();
    expect(comp.uniqueKeywords).toEqual(['gear', 'marine life', 'snorkelling']);
  });

  it('getUniqueKeywords ignores empty string keywords', () => {
    comp.allPosts = [makePost(['', 'gear'])];
    comp.getUniqueKeywords();
    expect(comp.uniqueKeywords).toEqual(['gear']);
  });

  it('getUniqueKeywords sets selectedKeywords to full unique list', () => {
    comp.allPosts = [makePost(['gear', 'marine life'])];
    comp.getUniqueKeywords();
    expect(comp.selectedKeywords).toEqual(comp.uniqueKeywords);
  });

  // --- onFilter ---

  it('onFilter removes a keyword that is already selected', () => {
    comp.allPosts = [makePost(['gear']), makePost(['marine life'])];
    comp.uniqueKeywords = ['gear', 'marine life'];
    comp.selectedKeywords = ['gear', 'marine life'];
    comp.filteredPosts = comp.allPosts;
    comp.onFilter('gear');
    expect(comp.selectedKeywords).not.toContain('gear');
    expect(comp.selectedKeywords).toContain('marine life');
  });

  it('onFilter adds a keyword that is not currently selected', () => {
    comp.allPosts = [makePost(['gear']), makePost(['marine life'])];
    comp.uniqueKeywords = ['gear', 'marine life'];
    comp.selectedKeywords = ['marine life'];
    comp.filteredPosts = comp.allPosts;
    comp.onFilter('gear');
    expect(comp.selectedKeywords).toContain('gear');
  });

  it('onFilter triggers filterBlogCards, hiding non-matching posts', () => {
    const p1 = makePost(['gear']);
    const p2 = makePost(['marine life']);
    comp.allPosts = [p1, p2];
    comp.selectedKeywords = ['gear'];
    comp.filteredPosts = [p1, p2];
    comp.onFilter('marine life'); // starts deselected — this adds it
    // both keywords selected → both posts shown
    expect(comp.filteredPosts.length).toBe(2);
  });

  // --- filterBlogCards ---

  it('filterBlogCards keeps posts that have at least one selectedKeyword', () => {
    const p1 = makePost(['gear']);
    const p2 = makePost(['marine life']);
    comp.allPosts = [p1, p2];
    comp.selectedKeywords = ['gear'];
    comp.filterBlogCards();
    expect(comp.filteredPosts).toEqual([p1]);
  });

  it('filterBlogCards returns empty when no keywords selected', () => {
    comp.allPosts = [makePost(['gear']), makePost(['marine life'])];
    comp.selectedKeywords = [];
    comp.filterBlogCards();
    expect(comp.filteredPosts.length).toBe(0);
  });

  // --- selectAll / selectNone ---

  it('selectAll restores filteredPosts to all posts', () => {
    const p1 = makePost(['gear']);
    const p2 = makePost(['marine life']);
    comp.allPosts = [p1, p2];
    comp.uniqueKeywords = ['gear', 'marine life'];
    comp.selectedKeywords = [];
    comp.filteredPosts = [];
    comp.selectAll();
    expect(comp.selectedKeywords).toEqual(['gear', 'marine life']);
    expect(comp.filteredPosts.length).toBe(2);
  });

  it('selectNone empties filteredPosts', () => {
    const p1 = makePost(['gear']);
    comp.allPosts = [p1];
    comp.uniqueKeywords = ['gear'];
    comp.selectedKeywords = ['gear'];
    comp.filteredPosts = [p1];
    comp.selectNone();
    expect(comp.selectedKeywords).toEqual([]);
    expect(comp.filteredPosts.length).toBe(0);
  });
});
