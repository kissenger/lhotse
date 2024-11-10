import { Component, Input } from '@angular/core';
import { CommonModule, NgOptimizedImage } from '@angular/common';
import { BlogPost } from '@shared/types';
import { RouterLink } from '@angular/router';

@Component({
  standalone: true,
  imports: [NgOptimizedImage, CommonModule, RouterLink],
  selector: 'app-blog-card',
  template: `

    <div class="blog-card" [routerLink]="'/blog/'+data.slug">

      <div class="photo">
        <img
          ngSrc="{{data.imgFname}}"
          alt="{{data.imgAlt}}"
          fill
          priority
        />
      </div>

      <div class="content">
        <h4>{{data.title}}</h4>
        <div class="subtitle">
          {{data.subtitle}}
        </div>
        <div class="footer">
          <div class="published-date">
            Published {{data.createdAt | date : 'MMM YYYY'}}
          </div>
          <div class="keywords">
            @for (kw of data.keywords; track kw) {
              <span class="kw">{{kw}}</span>
            }
          </div>
        </div>
      </div>
    </div>
  `,
  styleUrls: ['./blog-card.component.css'],
})

export class BlogCardComponent {
  @Input() public data: BlogPost = new BlogPost;

  constructor(
  ) {}

}

