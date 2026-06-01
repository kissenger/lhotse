import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { HttpService } from '@shared/services/http.service';
import { BlogPost } from '@shared/types';
import { FormsModule } from "@angular/forms";
import { NgClass } from '@angular/common';
import { KebaberPipe } from '@shared/pipes/kebaber.pipe';
import { ToastService } from '@shared/services/toast.service';
import { errorMessage } from '@shared/utils/error-message';

@Component({
  selector: 'app-blog-editor',
  standalone: true,
  imports: [NgClass, FormsModule],  
  providers: [KebaberPipe], 
  templateUrl: './blog-editor.component.html',
  styleUrl: './blog-editor.component.css'
})

export class BlogEditorComponent implements OnInit {

  public baseURL: string = `/articles/`;
  public isDirty: boolean = false;

  public uniqueKeywords: Array<string> = [];
  public blogSectionOptions: string[] = [];
  public newBlogSectionLabel: string = '';
  public selectedPost: BlogPost = new BlogPost;
  public askForConfirmation: boolean = false;
  public posts: Array<BlogPost> = [this.selectedPost];
  public showMarkdownHelp: boolean = false;
  public askForDiscardChanges: boolean = false;
  private _pendingNavAction: (() => void) | null = null;
  private _selectedPostSnapshot: BlogPost | null = null;

  constructor(
      private _http: HttpService,
      private _kebaber: KebaberPipe,
      private _cdr: ChangeDetectorRef,
      private _toaster: ToastService,
    ) {
    }
    
  async ngOnInit() {
    this.getPosts();
  }

  ensureReviewModel() {
    this._ensureBlogSection(this.selectedPost);
    if (!this.selectedPost.review) {
      this.selectedPost.review = {
        reviewKind: 'product',
        productName: '',
        brand: '',
        author: '',
        publisher: '',
        isbn: '',
        imageFname: '',
        imageAlt: '',
        imageCredit: '',
        summary: '',
        ratingValue: 4,
        ratingScale: 5,
        pros: [],
        cons: [],
        affiliateDisclosure: '',
        affiliateLinks: [],
        priceCurrency: 'GBP',
        priceValue: null,
        availability: '',
        sku: ''
      };
    }
    this.selectedPost.review.reviewKind = this.selectedPost.review.reviewKind || 'product';
    this.selectedPost.review.ratingScale = this.selectedPost.review.ratingScale || 5;
    this.selectedPost.review.ratingValue = Math.min(this.selectedPost.review.ratingScale, Math.max(0, this.selectedPost.review.ratingValue || 0));
    this.selectedPost.review.pros = this.selectedPost.review.pros || [];
    this.selectedPost.review.cons = this.selectedPost.review.cons || [];
    this.selectedPost.review.affiliateLinks = this.selectedPost.review.affiliateLinks || [];
    this.selectedPost.review.author = this.selectedPost.review.author || '';
    this.selectedPost.review.publisher = this.selectedPost.review.publisher || '';
    this.selectedPost.review.isbn = this.selectedPost.review.isbn || '';
    this.selectedPost.review.imageFname = this.selectedPost.review.imageFname || '';
    this.selectedPost.review.imageAlt = this.selectedPost.review.imageAlt || '';
    this.selectedPost.review.imageCredit = this.selectedPost.review.imageCredit || '';
  }

  get reviewLabel(): 'Product' | 'Book' {
    return this.selectedPost.review?.reviewKind === 'book' ? 'Book' : 'Product';
  }

  get isBlogSectionMissing(): boolean {
    return !this._cleanBlogSection(this.selectedPost.blogSection);
  }

  onTypeChange() {
    this._ensureBlogSection(this.selectedPost);
    if (this.selectedPost.type === 'review') {
      this.ensureReviewModel();
      if (this.selectedPost.review.productName === '') {
        this.selectedPost.review.productName = this.selectedPost.title;
      }
      if (this.selectedPost.keywords.length === 0) {
        this.selectedPost.keywords = this.selectedPost.review.reviewKind === 'book'
          ? ['book review', 'snorkelling book']
          : ['product review', 'snorkelling gear'];
      }
    }
    this._refreshBlogSectionOptions();
    this.isDirty = true;
  }

  onBlogSectionChange(value: string) {
    this.selectedPost.blogSection = this._cleanBlogSection(value);
    this._ensureBlogSection(this.selectedPost);
    this.isDirty = true;
  }

  addBlogSection() {
    const label = this._cleanBlogSection(this.newBlogSectionLabel);
    if (!label) {
      return;
    }

    if (!this.blogSectionOptions.includes(label)) {
      this.blogSectionOptions.push(label);
      this.blogSectionOptions.sort((a, b) => a.localeCompare(b));
    }

    this.selectedPost.blogSection = label;
    this.newBlogSectionLabel = '';
    this.isDirty = true;
  }

  getUniqueKeywords() {
    let kws: Array<string> = [];
    this.posts.forEach(p => {
      p.keywords.forEach(kw => {
        if(kw !== '' && !kws.includes(kw)) {
          kws.push(kw);
        }
      })
    })
    this.uniqueKeywords = kws.sort();
  }

  async getPosts() {
    try {
      const result = await this._http.getAllPosts();
      this.refreshPostList(result);
    } catch (error: any) {
      this._toaster.show(errorMessage(error, 'Could not load posts'), 'error');
    }
  }

  wordCountOver(v: string, max: number): boolean {
    return v ? v.split(' ').filter(w => w).length > max : false;
  }

  wordCountText(v: string, max: number): string {
    const count = v ? v.split(' ').filter(w => w).length : 0;
    return `${count} / ${max}`;
  }

  isSectionAltMissing(section: { imgFname?: string; videoUrl?: string; imgAlt?: string }): boolean {
    const hasMedia = !!(section.imgFname?.trim() || section.videoUrl?.trim());
    const hasAlt = !!section.imgAlt?.trim();
    return hasMedia && !hasAlt;
  }

  isYouTubeShortsUrl(value: string): boolean {
    const input = (value || '').trim();
    return input.includes('/shorts/');
  }

  makeSlug() {
    this.selectedPost.slug = this._kebaber.transform(this.selectedPost.title);
    return this.selectedPost.slug;
  }

  imgixThumb(fname: string): string {
    return `/assets/${fname}`;
  }

  onFormSelect(value: string) {
    if (this.isDirty) {
      this._pendingNavAction = () => {
        this.selectedPost = this.posts.find( (p) => p.slug === value) as BlogPost;
        this._ensureBlogSection(this.selectedPost);
        this.ensureReviewModel();
        this._captureSelectedPostSnapshot();
        this.isDirty = false;
      };
      this.askForDiscardChanges = true;
      return;
    }
    this.selectedPost = this.posts.find( (p) => p.slug === value) as BlogPost;
    this._ensureBlogSection(this.selectedPost);
    this.ensureReviewModel();
    this._captureSelectedPostSnapshot();
    this.isDirty = false;
  }

  onNewPost() {
    if (this.isDirty) {
      this._pendingNavAction = () => {
        this.selectedPost = new BlogPost();
        this._ensureBlogSection(this.selectedPost);
        this.ensureReviewModel();
        this._captureSelectedPostSnapshot();
        this.isDirty = false;
      };
      this.askForDiscardChanges = true;
      return;
    }
    this.selectedPost = new BlogPost();
    this._ensureBlogSection(this.selectedPost);
    this.ensureReviewModel();
    this._captureSelectedPostSnapshot();
    this.isDirty = false;
  }

  onConfirmDiscard() {
    this.askForDiscardChanges = false;
    this._pendingNavAction?.();
    this._pendingNavAction = null;
  }

  onCancelDiscard() {
    this.askForDiscardChanges = false;
    this._pendingNavAction = null;
    this._cdr.detectChanges();
  }

  moveUp(index: number) {
    if (index === 0) return;
    const s = this.selectedPost.sections;
    [s[index - 1], s[index]] = [s[index], s[index - 1]];
    this.isDirty = true;
  }

  moveDown(index: number) {
    const s = this.selectedPost.sections;
    if (index === s.length - 1) return;
    [s[index], s[index + 1]] = [s[index + 1], s[index]];
    this.isDirty = true;
  }

  addKeyword(event: KeyboardEvent, input: HTMLInputElement) {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    const kw = input.value.trim();
    if (kw && !this.selectedPost.keywords.includes(kw)) {
      this.selectedPost.keywords = [...this.selectedPost.keywords, kw];
      this.isDirty = true;
    }
    input.value = '';
  }

  addKeywordFromList(value: string, select: HTMLSelectElement) {
    if (value && !this.selectedPost.keywords.includes(value)) {
      this.selectedPost.keywords = [...this.selectedPost.keywords, value];
      this.isDirty = true;
    }
    select.value = '';
  }

  removeKeyword(index: number) {
    this.selectedPost.keywords = this.selectedPost.keywords.filter((_, i) => i !== index);
    this.isDirty = true;
  }

  addReviewListItem(type: 'pros' | 'cons', value: string, input: HTMLInputElement) {
    const trimmed = value.trim();
    if (!trimmed) return;
    this.ensureReviewModel();
    const list = this.selectedPost.review[type];
    if (!list.includes(trimmed)) {
      list.push(trimmed);
      this.isDirty = true;
    }
    input.value = '';
  }

  onReviewListKeydown(event: KeyboardEvent, type: 'pros' | 'cons', input: HTMLInputElement) {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    this.addReviewListItem(type, input.value, input);
  }

  removeReviewListItem(type: 'pros' | 'cons', index: number) {
    this.ensureReviewModel();
    this.selectedPost.review[type] = this.selectedPost.review[type].filter((_, i) => i !== index);
    this.isDirty = true;
  }

  addAffiliateLink() {
    this.ensureReviewModel();
    this.selectedPost.review.affiliateLinks?.push({ label: '', url: '' });
    this.isDirty = true;
  }

  removeAffiliateLink(index: number) {
    this.ensureReviewModel();
    this.selectedPost.review.affiliateLinks = (this.selectedPost.review.affiliateLinks || []).filter((_, i) => i !== index);
    this.isDirty = true;
  }

  private _inferOrientationFromVideoInput(value: string): 'landscape' | 'portrait' | null {
    const input = (value || '').trim();
    if (!input) return null;
    if (input.includes('/shorts/')) return 'portrait';
    return null;
  }

  onVideoUrlChange(section: { videoUrl?: string; videoOrientation?: 'landscape' | 'portrait' }): void {
    const inferredOrientation = this._inferOrientationFromVideoInput(section.videoUrl || '');
    if (inferredOrientation) {
      section.videoOrientation = inferredOrientation;
    }
    this.isDirty = true;
  }

  private _normaliseSectionVideosBeforeSave() {
    this.selectedPost.sections = this.selectedPost.sections.map((section) => {
      if (!section.videoUrl) return section;

      const inferredOrientation = this._inferOrientationFromVideoInput(section.videoUrl);

      return {
        ...section,
        videoUrl: section.videoUrl.trim(),
        videoOrientation: section.videoOrientation || inferredOrientation || 'landscape'
      };
    });
  }

  addQA() {
    this.selectedPost.sections.push({title: "", content: "", imgFname: "", imgAlt: "", videoUrl: "", imgCredit: ""});
    this.isDirty = true;
  }

  addCtaSection() {
    this.selectedPost.sections.push({
      title: '', content: '', imgFname: '', imgAlt: '', videoUrl: '', imgCredit: '',
      sectionType: 'cta',
      ctaLinks: [{ label: '', url: '' }],
    });
    this.isDirty = true;
  }

  addCtaLink(sectionIndex: number) {
    const section = this.selectedPost.sections[sectionIndex];
    if (!section.ctaLinks) section.ctaLinks = [];
    section.ctaLinks.push({ label: '', url: '' });
    this.isDirty = true;
  }

  removeCtaLink(sectionIndex: number, linkIndex: number) {
    this.selectedPost.sections[sectionIndex].ctaLinks?.splice(linkIndex, 1);
    this.isDirty = true;
  }

  deleteQA(index: number) {
    this.selectedPost.sections.splice(index, 1);
    this.isDirty = true;
  }

  async onTogglePublish() {
    if (this.selectedPost.publishedAt) {
      this.selectedPost.publishedAt = '';  // sentinel: server will set publishedAt = null
    } else {
      this.selectedPost.publishedAt = 'publish';  // sentinel: server will set publishedAt = now
    }
    this.isDirty = true;
    await this.onSave();
  }

  async onSave() {
    try {
      this._ensureBlogSection(this.selectedPost);
      if (!this.selectedPost.blogSection) {
        this._toaster.show('Please select a blog section before saving.', 'warning');
        return;
      }
      const preserveUpdatedAt = this._shouldPreserveUpdatedAt();
      this.ensureReviewModel();
      this._normaliseSectionVideosBeforeSave();
      if (this.selectedPost.type !== 'review') {
        this.selectedPost.review = {
          reviewKind: 'product',
          productName: '',
          brand: '',
          author: '',
          publisher: '',
          isbn: '',
          imageFname: '',
          imageAlt: '',
          imageCredit: '',
          summary: '',
          ratingValue: 4,
          ratingScale: 5,
          pros: [],
          cons: [],
          affiliateDisclosure: '',
          affiliateLinks: [],
          priceCurrency: 'GBP',
          priceValue: null,
          availability: '',
          sku: ''
        };
      }
      const slug = this.selectedPost.slug;
      const result = await this._http.upsertPost(this.selectedPost, { preserveUpdatedAt });
      this.refreshPostList(result);
      this.selectedPost = this.posts.find(p => p.slug == slug) as BlogPost;
      this.ensureReviewModel();
      this._captureSelectedPostSnapshot();
      this.isDirty = false;
      this._toaster.show('Post saved successfully.', 'success');
    } catch (error: any) {
      this._toaster.show(errorMessage(error, 'Could not save post'), 'error');
    }
  }

  async onYesDelete(areYouSure: boolean = false) {
    if (areYouSure === false) {
      this.askForConfirmation = true;
    }
    else {
      this.askForConfirmation = false;
      try {
        const result = await this._http.deletePost(this.selectedPost._id);
        this.refreshPostList(result);
        this.isDirty = false;
        this._toaster.show('Post deleted.', 'success');
      } catch (error: any) {
        this._toaster.show(errorMessage(error, 'Could not delete post'), 'error');
      }
   }
  }

  onNoDelete() {
    this.askForConfirmation = false;
  }

  refreshPostList(newData: Array<BlogPost>) {
    newData.sort((a, b) => {
      const aPublished = !!a.publishedAt;
      const bPublished = !!b.publishedAt;
      if (aPublished !== bPublished) return aPublished ? 1 : -1;
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });
    this.selectedPost = new BlogPost;
    this._ensureBlogSection(this.selectedPost);
    this.ensureReviewModel();
    this._captureSelectedPostSnapshot();
    this.posts = [this.selectedPost];
    newData.forEach((post) => this._ensureBlogSection(post));
    this.posts.push(...newData);
    this.getUniqueKeywords();
    this._refreshBlogSectionOptions();
    this._cdr.detectChanges();
  }

  private _refreshBlogSectionOptions() {
    const sections = new Set<string>();

    this.posts.forEach((post) => {
      const sectionTitle = this._cleanBlogSection(post.blogSection);
      if (sectionTitle) {
        sections.add(sectionTitle);
      }
    });

    this.blogSectionOptions = Array.from(sections).sort((a, b) => a.localeCompare(b));
  }

  private _ensureBlogSection(post: BlogPost) {
    const explicit = this._cleanBlogSection(post.blogSection);
    post.blogSection = explicit;
  }

  private _captureSelectedPostSnapshot() {
    this._selectedPostSnapshot = this._clonePost(this.selectedPost);
  }

  private _clonePost(post: BlogPost | null): BlogPost | null {
    if (!post) {
      return null;
    }

    return JSON.parse(JSON.stringify(post)) as BlogPost;
  }

  private _shouldPreserveUpdatedAt(): boolean {
    if (!this.selectedPost._id || !this._selectedPostSnapshot) {
      return false;
    }

    const originalSection = this._cleanBlogSection(this._selectedPostSnapshot.blogSection);
    const currentSection = this._cleanBlogSection(this.selectedPost.blogSection);

    if (originalSection === currentSection) {
      return false;
    }

    return this._getPostStateIgnoringSection(this._selectedPostSnapshot) === this._getPostStateIgnoringSection(this.selectedPost);
  }

  private _getPostStateIgnoringSection(post: BlogPost | null): string {
    if (!post) {
      return '';
    }

    const clone = this._clonePost(post) as any;
    delete clone.blogSection;
    delete clone.updatedAt;
    delete clone.createdAt;

    return JSON.stringify(clone);
  }

  private _cleanBlogSection(value?: string): string {
    return (value || '').trim();
  }
}