import { Component, Input } from '@angular/core';
import { CommonModule, NgOptimizedImage } from '@angular/common';
import { BlogPost } from '@shared/types';
import { RouterLink } from '@angular/router';
import { environment } from '@environments/environment';

@Component({
  standalone: true,
  imports: [NgOptimizedImage, CommonModule, RouterLink],
  selector: 'app-blog-card',
  template: `

    <div class="blog-card" [routerLink]="'/blog/'+data.slug">

      <div class="photo">
        @if (stage==='dev') {
          <img
            [src]="'assets/'+data.imgFname"
            [alt]="data.imgAlt"
            fill /> 
        } @else {
          <img
            [ngSrc]="data.imgFname"
            [alt]="data.imgAlt"
            fill /> 
        }
      </div>

      <div class="content">
        <h4>{{data.title}}</h4>
        <div class="subtitle">
          {{data.subtitle}}
        </div>
        <div class="footer">
          @for (kw of data.keywords; track kw) {
            <span class="kw">{{kw}}</span>
          }
        </div>
      </div>
    </div>
  `,
  styleUrls: ['./blog-card.component.css'],
})

export class BlogCardComponent {
  @Input() public data: BlogPost = new BlogPost;
  public stage=environment.STAGE;
}

