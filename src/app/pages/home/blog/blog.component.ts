import { ChangeDetectorRef, Component, HostListener, Inject, PLATFORM_ID, OnInit } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpService } from '@shared/services/http.service';
import { BlogPost } from '@shared/types';
import { LoaderComponent } from '@shared/components/loader/loader.component';
import { BlogCardComponent } from './blog-card/blog-card.component';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

@Component({
  standalone: true,
  imports: [ BlogCardComponent, CommonModule, LoaderComponent, RouterLink ],
  selector: 'app-blog',
  templateUrl: './blog.component.html',
  styleUrls: ['./blog.component.css'],
})

export class BlogComponent implements OnInit {
  public groupedPosts: Array<{ title: string; slug: string; description: string; posts: BlogPost[] }> = [];
  public allPosts: Array<BlogPost> = [];
  public loadingState: 'loading' | 'failed' | 'success' = 'loading';
  public activeSectionSlug = '';
  private _activeSectionTicking = false;

  // Blog page text content (DRY - defined once in component)
  public readonly pageHeading = 'British Snorkelling Articles';
  public readonly defaultSections: Array<{ title: string; slug: string; description: string }> = [
    { title: 'Snorkelling Sites', slug: 'snorkelling-sites', description: 'Guides to coastlines, bays and standout entry points around Britain.' },
    { title: 'News', slug: 'news', description: 'Latest snorkelology updates, launches and notable developments.' },
    { title: 'Reviews', slug: 'product-reviews', description: 'Field-tested thoughts on snorkelling gear, books, cameras and practical kit.' },
    { title: 'Science and Nature', slug: 'science-and-nature', description: 'Marine life, habitat insights and underwater ecology explained.' },
    { title: 'British Snorkelling', slug: 'british-snorkelling', description: 'Broader stories, skills and experiences from UK snorkelling life.' }
  ];

  public get contentsSections() {
    return this.groupedPosts.filter((section) => section.posts.length > 0);
  }

  public get resultSummary() {
    if (this.loadingState !== 'success') {
      return '';
    }

    const total = this.allPosts.length;
    return `${total} article${total === 1 ? '' : 's'} in this archive`;
  }

  constructor(
    private _http: HttpService,
    @Inject(PLATFORM_ID) private _platformId: any,
    private _cdr: ChangeDetectorRef
  ) {
  }

  ngOnInit() {
    if (!isPlatformBrowser(this._platformId)) return;
    this._loadPosts();
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
      this.allPosts = posts as BlogPost[];
      this.loadingState = 'success';
      this.groupedPosts = this._groupPosts(this.allPosts);
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

  private _groupPosts(posts: BlogPost[]) {
    const defaultByTitle = new Map(this.defaultSections.map((section) => [section.title, section]));
    const grouped = new Map<string, { title: string; slug: string; description: string; posts: BlogPost[] }>();

    this.defaultSections.forEach((section) => {
      grouped.set(section.title, { ...section, posts: [] });
    });

    posts.forEach((post) => {
      const sectionTitle = this._normaliseSectionTitle(post.blogSection);
      if (!sectionTitle) {
        return;
      }

      if (!grouped.has(sectionTitle)) {
        grouped.set(sectionTitle, {
          title: sectionTitle,
          slug: this._normaliseSectionSlug(sectionTitle),
          description: 'Articles in this section.',
          posts: []
        });
      }

      grouped.get(sectionTitle)?.posts.push(post);
    });

    return Array.from(grouped.values()).sort((a, b) => {
      const indexA = this.defaultSections.findIndex((section) => section.title === a.title);
      const indexB = this.defaultSections.findIndex((section) => section.title === b.title);
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
      if (defaultByTitle.has(section.title)) {
        const defaults = defaultByTitle.get(section.title)!;
        return {
          ...section,
          title: defaults.title,
          description: defaults.description
        };
      }

      return section;
    });
  }

  private _normaliseSectionTitle(value?: string): string {
    return (value || '')
      .toString()
      .trim();
  }

  private _normaliseSectionSlug(value?: string): string {
    return (value || '')
      .toString()
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
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

    const headerOffset = 96;
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
