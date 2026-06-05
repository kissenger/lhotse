import { ChangeDetectorRef, Component, HostListener, Inject, OnDestroy, OnInit, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpService } from '@shared/services/http.service';
import { ArticlePost } from '@shared/types';
import { LoaderComponent } from '@shared/components/loader/loader.component';
import { ArticleCardComponent } from './article-card/article-card.component';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { normalizeText, normalizeToSlug } from '@shared/utils/text-normalization';
import { ScrollOffsetService } from '@shared/services/scroll-offset.service';

@Component({
  standalone: true,
  imports: [ ArticleCardComponent, CommonModule, LoaderComponent, RouterLink ],
  selector: 'app-article',
  templateUrl: './article.component.html',
  styleUrls: ['./article.component.css'],
})

export class ArticleComponent implements OnInit, OnDestroy {
  public groupedPosts: Array<{ title: string; slug: string; description: string; posts: ArticlePost[] }> = [];
  public allGroupedPosts: Array<{ title: string; slug: string; description: string; posts: ArticlePost[] }> = [];
  public latestPosts: Array<ArticlePost> = [];
  public selectedSectionSlug: string = '';
  public allPosts: Array<ArticlePost> = [];
  public loadingState: 'loading' | 'failed' | 'success' = 'loading';
  public activeSectionSlug = '';
  public sectionPostCounts = new Map<string, number>();
  private _activeSectionTicking = false;
  private _routeParamSub: Subscription | null = null;

  // Article page text content (DRY - defined once in component)
  public readonly pageHeading = 'British Snorkelling Articles';
  public readonly pageLead = 'Welcome to our articles page where we share the latest news, insights and guides on British snorkelling. Whether you\'re looking for tips on the best local spots, gear reviews or stories from the water, you\'ll find it all here. Dive (or snorkel!) in and explore our growing collection of British snorkelling content.';
  public readonly latestCount = 5;
  public readonly defaultSections: Array<{ title: string; slug: string; description: string }> = [
    { title: 'Snorkelling Sites', slug: 'snorkelling-sites', description: 'Guides to coastlines, bays and standout entry points around Britain.' },
    { title: 'News', slug: 'news', description: 'Latest snorkelology updates, launches and notable developments.' },
    { title: 'Reviews', slug: 'reviews', description: 'Field-tested thoughts on snorkelling gear, books, cameras and practical kit.' },
    { title: 'Science and Nature', slug: 'science-and-nature', description: 'Marine life, habitat insights and underwater ecology explained.' },
    { title: 'British Snorkelling', slug: 'british-snorkelling', description: 'Broader stories, skills and experiences from UK snorkelling life.' }
  ];

  public get contentsSections() {
    return this.groupedPosts.filter((section) => section.posts.length > 0);
  }

  public get showLatestSection(): boolean {
    return !this.selectedSectionSlug && this.latestPosts.length > 0;
  }

  public get isSectionFilteredRoute(): boolean {
    return !!this.selectedSectionSlug;
  }

  public get selectedSectionTitle(): string {
    if (!this.selectedSectionSlug) {
      return '';
    }

    const section = this.allGroupedPosts.find((item) => item.slug === this.selectedSectionSlug);
    return section?.title || this.selectedSectionSlug;
  }

  public get topicLinks() {
    return [
      { title: 'All Topics', slug: '', count: this.allPosts.length },
      ...this.allGroupedPosts
        .filter((section) => (this.sectionPostCounts.get(section.slug) || 0) > 0)
        .map((section) => ({
          title: section.title,
          slug: section.slug,
          count: this.sectionPostCounts.get(section.slug) || 0
        }))
    ];
  }

  constructor(
    private _http: HttpService,
    private _route: ActivatedRoute,
    @Inject(PLATFORM_ID) private _platformId: any,
    private _cdr: ChangeDetectorRef,
    @Inject(ScrollOffsetService) private _scrollOffset: ScrollOffsetService
  ) {
  }

  ngOnInit() {
    if (!isPlatformBrowser(this._platformId)) return;
    this._syncSectionFromRoute();
    this._routeParamSub = this._route.paramMap.subscribe(() => {
      this._syncSectionFromRoute();
      this._rebuildViewModel();
      this._cdr.detectChanges();
    });
    this._loadPosts();
  }

  ngOnDestroy(): void {
    this._routeParamSub?.unsubscribe();
  }

  @HostListener('window:scroll')
  onWindowScroll() {
    this._scheduleActiveSectionSync();
  }

  @HostListener('window:hashchange')
  onHashChange() {
    this._syncActiveSectionFromHash();
  }

  private async _loadPosts(bustCache = false) {
    this.loadingState = 'loading';
    try {
      const posts = await Promise.race([
        this._http.getPublishedPosts(bustCache),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), 15000))
      ]);
      this.allPosts = this._sortByRecency(posts as ArticlePost[]);
      this.loadingState = 'success';
      this._rebuildViewModel();
      this._syncActiveSectionFromHash();
      this._scheduleActiveSectionSync();
      this._cdr.detectChanges();
    } catch {
      this.loadingState = 'failed';
      this._cdr.detectChanges();
    }
  }

  async onRetry() {
    await this._loadPosts(true);
  }

  private _groupPosts(posts: ArticlePost[]) {
    const defaultByTitle = new Map(this.defaultSections.map((section) => [section.title.toLowerCase(), section]));
    const grouped = new Map<string, { title: string; slug: string; description: string; posts: ArticlePost[] }>();

    this.defaultSections.forEach((section) => {
      grouped.set(section.title.toLowerCase(), { ...section, posts: [] });
    });

    posts.forEach((post) => {
      const sectionTitle = normalizeText(post.articleSection);
      if (!sectionTitle) {
        return;
      }

      const sectionKey = sectionTitle.toLowerCase();
      const defaults = defaultByTitle.get(sectionKey);

      if (!grouped.has(sectionKey)) {
        grouped.set(sectionKey, {
          title: defaults?.title || sectionTitle,
          slug: defaults?.slug || normalizeToSlug(sectionTitle),
          description: 'Articles in this section.',
          posts: []
        });
      }

      grouped.get(sectionKey)?.posts.push(post);
    });

    return Array.from(grouped.values()).sort((a, b) => {
      const indexA = this.defaultSections.findIndex((section) => section.title.toLowerCase() === a.title.toLowerCase());
      const indexB = this.defaultSections.findIndex((section) => section.title.toLowerCase() === b.title.toLowerCase());
      const rankA = indexA >= 0 ? indexA : Number.MAX_SAFE_INTEGER;
      const rankB = indexB >= 0 ? indexB : Number.MAX_SAFE_INTEGER;

      if (rankA !== rankB) {
        return rankA - rankB;
      }

      if (rankA !== Number.MAX_SAFE_INTEGER) {
        return 0;
      }

      return a.title.localeCompare(b.title);
    }).map((section) => {
      const defaults = defaultByTitle.get(section.title.toLowerCase());
      if (defaults) {
        return {
          ...section,
          title: defaults.title,
          slug: defaults.slug,
          description: defaults.description
        };
      }

      return section;
    });
  }

  private _rebuildViewModel() {
    const grouped = this._groupPosts(this.allPosts);
    this.allGroupedPosts = grouped;
    this.latestPosts = this.allPosts.slice(0, this.latestCount);
    this.sectionPostCounts = new Map(grouped.map((section) => [section.slug, section.posts.length]));

    if (this.isSectionFilteredRoute) {
      this.groupedPosts = grouped.filter((section) => this._canonicalSectionSlug(section.slug) === this.selectedSectionSlug);
      return;
    }

    this.groupedPosts = grouped;
  }

  private _syncSectionFromRoute() {
    this.selectedSectionSlug = this._canonicalSectionSlug(normalizeToSlug(this._route.snapshot.paramMap.get('sectionSlug') || ''));
  }

  private _canonicalSectionSlug(value: string): string {
    const slug = normalizeToSlug(value);
    if (slug === 'product-reviews') {
      return 'reviews';
    }
    return slug;
  }

  private _sortByRecency(posts: ArticlePost[]): ArticlePost[] {
    return [...posts].sort((a, b) => {
      const aTs = this._toTimestamp(a.publishedAt) || this._toTimestamp(a.updatedAt) || this._toTimestamp(a.createdAt);
      const bTs = this._toTimestamp(b.publishedAt) || this._toTimestamp(b.updatedAt) || this._toTimestamp(b.createdAt);
      return bTs - aTs;
    });
  }

  private _toTimestamp(value?: string): number {
    const stamp = Date.parse((value || '').trim());
    return Number.isFinite(stamp) ? stamp : 0;
  }

  private _scheduleActiveSectionSync() {
    if (!isPlatformBrowser(this._platformId) || this.loadingState !== 'success' || this._activeSectionTicking) {
      return;
    }

    this._activeSectionTicking = true;
    requestAnimationFrame(() => {
      this._activeSectionTicking = false;
      this._syncActiveSectionFromViewport();
    });
  }

  private _syncActiveSectionFromHash() {
    if (!isPlatformBrowser(this._platformId)) {
      return;
    }

    const hash = window.location.hash.replace('#', '');
    if (!hash) {
      return;
    }

    if (this.contentsSections.some((section) => section.slug === hash)) {
      this.activeSectionSlug = hash;
    }
  }

  private _syncActiveSectionFromViewport() {
    const sections = Array.from(document.querySelectorAll<HTMLElement>('.category-section[id]'));
    if (!sections.length) {
      return;
    }

    const headerOffset = this._scrollOffset.getFragmentOffset(0);
    const visibleSection = sections
      .map((section) => ({
        slug: section.id,
        top: section.getBoundingClientRect().top
      }))
      .filter((section) => section.top <= headerOffset)
      .sort((a, b) => b.top - a.top)[0];

    const fallbackSection = sections
      .map((section) => ({
        slug: section.id,
        top: section.getBoundingClientRect().top
      }))
      .sort((a, b) => a.top - b.top)[0];

    this.activeSectionSlug = visibleSection?.slug || fallbackSection?.slug || this.activeSectionSlug;
  }
}
