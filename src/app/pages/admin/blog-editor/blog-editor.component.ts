import { Component, Inject, OnDestroy, OnInit } from '@angular/core';
import { HttpService } from '@shared/services/http.service';
import { BlogPost } from '@shared/types';
import { Subscription } from 'rxjs';
import { FormsModule } from "@angular/forms";
import { CommonModule, DOCUMENT, NgClass  } from '@angular/common';
import { KebaberPipe } from '@shared/pipes/kebaber.pipe';
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
  public baseURL: string = `${environment.PROTOCOL}://${environment.BASE_URL}/blog/`;

  public uniqueKeywords: Array<string> = [];
  public selectedPost: BlogPost = new BlogPost;
  public askForConfirmation: boolean = false;
  public posts: Array<BlogPost> = [this.selectedPost];
  
  constructor(
      private _http: HttpService,
      private _kebaber: KebaberPipe,
      @Inject(DOCUMENT) private _document: Document
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
      this._window!.alert(`Something didn't work, with error message: \n${error.error.message}`);          
    }
  }

  wordCount(v: string, n: number) {
    return v.split(" ").length > n;
  }

  makeSlug() {
    this.selectedPost.slug = this._kebaber.transform(this.selectedPost.title);
    return this.selectedPost.slug;
  }

  onFormSelect(value: string) {
    this.selectedPost = this.posts.find( (p) => p.slug === value) as BlogPost;
  }

  onMoveSection(fromIndex: number, toIndex: string) {
    const elementToMove = this.selectedPost.sections[fromIndex];
    this.selectedPost.sections.splice(fromIndex,1);
    this.selectedPost.sections.splice(parseInt(toIndex),0,elementToMove);
  }

  addQA() {
    this.selectedPost.sections.push({title: "", content: "", imgFname: "", imgAlt: ""})
  }

  deleteQA(index: number) {
    this.selectedPost.sections.splice(index,1); 
  }

  onAddKW(value: string) {
    this.selectedPost.keywords = [...this.selectedPost.keywords, value];
  }

  onKeywordsChange(event: any) {
    this.selectedPost.keywords = event.target.value
      .split(",")
      .map( (kw: string) => kw.trim())
      .filter( (kw: string) => kw !== '');
  }

  async onSave() {
    try {
      const slug = this.selectedPost.slug;
      const result = await this._http.upsertPost(this.selectedPost);
      this.refreshPostList(result);
      this.selectedPost = this.posts.find(p => p.slug == slug) as BlogPost;
      this._window!.alert("Post successfully updated!");
    } catch (error: any) {
      console.error(error);
      this._window!.alert(`Something didn't work, with error message: \n${error.error.message}`);
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
        this._window!.alert("Post successfully deleted!");
      } catch (error: any) {
        console.error(error);
        this._window!.alert(`Something didn't work, with error message: \n${error.error.message}`);
      }
   }
  }

  onNoDelete() {
    this.askForConfirmation = false;
  }

  refreshPostList(newData: Array<BlogPost>) {
    this.selectedPost = new BlogPost;
    this.posts = [this.selectedPost];
    this.posts.push(...newData);  
    this.getUniqueKeywords();
  }
}