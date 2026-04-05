import { ChangeDetectorRef, Component, Inject, OnInit } from '@angular/core';
import { HttpService } from '@shared/services/http.service';
import { BlogPost } from '@shared/types';
import { FormsModule } from "@angular/forms";
import { CommonModule, DOCUMENT, NgClass  } from '@angular/common';
import { KebaberPipe } from '@shared/pipes/kebaber.pipe';
import { ToastService } from '@shared/services/toast.service';
import { environment } from '@environments/environment';

@Component({
  selector: 'app-blog-editor',
  standalone: true,
  imports: [NgClass, FormsModule],  
  providers: [CommonModule, KebaberPipe], 
  templateUrl: './blog-editor.component.html',
  styleUrl: './blog-editor.component.css'
})

export class BlogEditorComponent implements OnInit {

  private _window;
  public baseURL: string = `/blog/`;
  public isDirty: boolean = false;

  public uniqueKeywords: Array<string> = [];
  public selectedPost: BlogPost = new BlogPost;
  public askForConfirmation: boolean = false;
  public posts: Array<BlogPost> = [this.selectedPost];
  public showMarkdownHelp: boolean = false;
  
  constructor(
      private _http: HttpService,
      private _kebaber: KebaberPipe,
      private _cdr: ChangeDetectorRef,
      private _toaster: ToastService,
      @Inject(DOCUMENT) _document: Document
    ) {
      this._window = _document.defaultView;
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

  makeSlug() {
    this.selectedPost.slug = this._kebaber.transform(this.selectedPost.title);
    return this.selectedPost.slug;
  }

  imgixThumb(fname: string): string {
    return `https://${environment.IMGIX_DOMAIN}${fname}?w=60&h=60&fit=crop&auto=format`;
  }

  onFormSelect(value: string) {
    if (this.isDirty) {
      const confirmed = this._window?.confirm?.('You have unsaved changes. Switch post and lose them?');
      if (!confirmed) return;
    }
    this.selectedPost = this.posts.find( (p) => p.slug === value) as BlogPost;
    this.isDirty = false;
  }

  onNewPost() {
    if (this.isDirty) {
      const confirmed = this._window?.confirm?.('You have unsaved changes. Start a new post and lose them?');
      if (!confirmed) return;
    }
    this.selectedPost = new BlogPost();
    this.isDirty = false;
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

  deleteQA(index: number) {
    const confirmed = this._window?.confirm?.('Delete this section? This cannot be undone.');
    if (!confirmed) {
      return;
    }
    this.selectedPost.sections.splice(index, 1);
    this.isDirty = true;
  }

  onTogglePublish() {
    if (this.selectedPost.publishedAt) {
      this.selectedPost.publishedAt = '';  // sentinel: server will set publishedAt = null
    } else {
      this.selectedPost.publishedAt = 'publish';  // sentinel: server will set publishedAt = now
    }
    this.isDirty = true;
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