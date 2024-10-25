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
  public baseURL:string = `${environment.PROTOCOL}://${environment.BASE_URL}/blog/`;

  public selectedPost = new BlogPost;
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
    // if (this.isChanged) {
    //   this._window!.alert("Unsaved changed, use save or cancel button to leave");
    // } else {  
      this.selectedPost = this.posts[parseInt(value,10)];
    // }
  }

  onChange() {
    // this.isChanged = true;
  }


  addQA() {
    // this.isChanged = true;
    this.selectedPost.faqs.push({question: " ", answer: " "})
  }

  deleteQA(index: number) {
    // this.isChanged = true;
    this.selectedPost.faqs.splice(index,1);
  }

  keywords(kws: string) {
    this.selectedPost.keywords = kws.split(',').map(kw => kw.trim())
  }

  onSave() {
    const slug = this.selectedPost.slug;
    this._httpSubs = this._http.upsertPost(this.selectedPost)
      .subscribe({
        next: (result) => {
          this.refreshPostList(result);
          this.selectedPost = this.posts.filter(p => p.slug == slug)[0];
          console.log(this.posts)
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
      console.log(this.selectedPost);
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
  }

  ngOnDestroy() {
    this._httpSubs?.unsubscribe();
  }
}