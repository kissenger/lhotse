import { Component, Inject, OnDestroy, OnInit } from '@angular/core';
import { HttpService } from '@shared/services/http.service';
import { BlogPost } from '@shared/types';
import { Subscription } from 'rxjs';
import { FormsModule } from "@angular/forms";
import { CommonModule, DOCUMENT, NgClass  } from '@angular/common';
import { PostShowerComponent } from '../shower/post-shower.component';
import { KebaberPipe } from '@shared/pipes/kebaber.pipe';
import { environment } from '@environments/environment';

@Component({
  selector: 'app-blog-editor',
  standalone: true,
  imports: [NgClass, FormsModule, PostShowerComponent, KebaberPipe],  
  providers: [CommonModule, KebaberPipe], 
  templateUrl: './blog-editor.component.html',
  styleUrl: './blog-editor.component.css'
})

export class BlogEditorComponent implements OnInit, OnDestroy {

  private _httpSubs: Subscription | undefined;
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
    console.log(kws);
  }

  getPosts() {
    this._httpSubs = this._http.getAllPosts()
      .subscribe({
        next: (result) => {
          this.refreshPostList(result);
        },
        error: (error) => {
          console.log(error);
          this._window!.alert(`Something didn't work, with error message: \n${error.error.message}`);          
        }
      }) 
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

  

  onSave() {
    const slug = this.selectedPost.slug;
    this._httpSubs = this._http.upsertPost(this.selectedPost)
      .subscribe({
        next: (result) => {
          this.refreshPostList(result);
          this.selectedPost = this.posts.find(p => p.slug == slug) as BlogPost;
          this._window!.alert("Post successfully updated!");
        },
        error: (error) => {
          console.log(error);
          this._window!.alert(`Something didn't work, with error message: \n${error.error.message}`);
        }
      }) 
  }

  onYesDelete(areYouSure: boolean = false) {
    if (areYouSure === false) {
      this.askForConfirmation = true;
    }
    else {
      this.askForConfirmation = false;
      this._httpSubs = this._http.deletePost(this.selectedPost._id)
        .subscribe({
          next: (result) => {
            this.refreshPostList(result);
            this._window!.alert("Post successfully deleted!");
          },
          error: (error) => {
            console.log(error);
            this._window!.alert(`Something didn't work, with error message: \n${error.error.message}`);
          }
        })    
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

    console.log(this.uniqueKeywords)
  }

  ngOnDestroy() {
    this._httpSubs?.unsubscribe();
  }
}