import { Component, Inject, OnDestroy, OnInit } from '@angular/core';
import { HttpService } from '@shared/services/http.service';
import { BlogPost } from '@shared/types';
import { Subscription } from 'rxjs';
import { FormsModule } from "@angular/forms";
import { CommonModule, DOCUMENT, NgClass  } from '@angular/common';
import { PostShowerComponent } from '../shower/post-shower.component';

@Component({
  selector: 'app-blog-editor',
  standalone: true,
  imports: [NgClass, FormsModule, PostShowerComponent],  
  providers: [CommonModule],
  templateUrl: './blog-editor.component.html',
  styleUrl: './blog-editor.component.css'
})

export class BlogEditorComponent implements OnInit, OnDestroy {

  private _httpSubs: Subscription | undefined;
  private _window;

  public selectedPost = new BlogPost;
  public askForConfirmation: boolean = false;
  public posts: Array<BlogPost> = [this.selectedPost];
  
  // private isChanged: boolean = false;

  constructor(
      private _http: HttpService,
      @Inject(DOCUMENT) private _document:Document
    ) {
      this._window = _document.defaultView;
    }
    
  async ngOnInit() {
    this.getPosts();
  }

  slugMaker() {
    this.selectedPost.slug = this.selectedPost.title.replaceAll(/[^\p{L}\d\s]+/gu, '').replaceAll(' ', '-').toLowerCase();
    return this.selectedPost.slug;
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

  onReset() {
    const slug = this.selectedPost.slug;
    this.getPosts();
    // this.isChanged = false;
  }

  addQA() {
    // this.isChanged = true;
    this.selectedPost.faqs.push({question: " ", answer: " "})
  }

  deleteQA(index: number) {
    // this.isChanged = true;
    this.selectedPost.faqs.splice(index,1);
  }

  onSave() {
    this._httpSubs = this._http.upsertPost(this.selectedPost)
      .subscribe({
        next: (result) => {
          this.refreshPostList(result);
          this._window!.alert("Post successfully updated!");
        },
        error: (error) => {
          console.log(error);
          this._window!.alert(`Something didn't work, with error message: \n${error.error.message}`);
        }
      }) 
  }

  onDelete(areYouSure: boolean = false) {
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

  refreshPostList(newData: Array<BlogPost>) {
    this.selectedPost = new BlogPost;
    this.posts = [this.selectedPost];
    this.posts.push(...newData);    
  }

  ngOnDestroy() {
    this._httpSubs?.unsubscribe();
  }
}