import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { HttpService } from '@shared/services/http.service';
import { BlogPost } from '@shared/types';
import { FormsModule } from "@angular/forms";
import { NgClass } from '@angular/common';
import { KebaberPipe } from '@shared/pipes/kebaber.pipe';
import { ToastService } from '@shared/services/toast.service';

@Component({
  selector: 'app-blog-editor',
  standalone: true,
  imports: [NgClass, FormsModule],  
  providers: [KebaberPipe], 
  templateUrl: './blog-editor.component.html',
  styleUrl: './blog-editor.component.css'
})

export class BlogEditorComponent implements OnInit {

  public baseURL: string = `/blog/`;
  public isDirty: boolean = false;

  public uniqueKeywords: Array<string> = [];
  public selectedPost: BlogPost = new BlogPost;
  public askForConfirmation: boolean = false;
  public posts: Array<BlogPost> = [this.selectedPost];
  public showMarkdownHelp: boolean = false;
  public askForDiscardChanges: boolean = false;
  private _pendingNavAction: (() => void) | null = null;

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
      console.error(error);
      this._toaster.show(error?.error?.message || 'Could not load posts', 'error');
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
        this.isDirty = false;
      };
      this.askForDiscardChanges = true;
      return;
    }
    this.selectedPost = this.posts.find( (p) => p.slug === value) as BlogPost;
    this.isDirty = false;
  }

  onNewPost() {
    if (this.isDirty) {
      this._pendingNavAction = () => {
        this.selectedPost = new BlogPost();
        this.isDirty = false;
      };
      this.askForDiscardChanges = true;
      return;
    }
    this.selectedPost = new BlogPost();
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
      const slug = this.selectedPost.slug;
      const result = await this._http.upsertPost(this.selectedPost);
      this.refreshPostList(result);
      this.selectedPost = this.posts.find(p => p.slug == slug) as BlogPost;
      this.isDirty = false;
      this._toaster.show('Post saved successfully.', 'success');
    } catch (error: any) {
      console.error(error);
      this._toaster.show(error?.error?.message || 'Could not save post', 'error');
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
        console.error(error);
        this._toaster.show(error?.error?.message || 'Could not delete post', 'error');
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
    this.posts = [this.selectedPost];
    this.posts.push(...newData);
    this.getUniqueKeywords();
    this._cdr.detectChanges();
  }
}