import { Component, Input } from '@angular/core';
import { CommonModule, NgOptimizedImage } from '@angular/common';
import { BlogPost } from '@shared/types';
import { RouterLink } from '@angular/router';

@Component({
  standalone: true,
  imports: [NgOptimizedImage, CommonModule, RouterLink],
  selector: 'app-blog-card',
  template: `

    <div class="blog-card" [routerLink]="'blog/'+data.slug">

      <div class="photo">
        <img
          ngSrc="{{data.imgFname}}"
          alt="{{data.imgAlt}}"
          fill
        />
      </div>

      <div class="content">
        <div class="title">{{data.title}}</div>
        <div class="subtitle">{{data.subtitle}}</div>
        <div class="footer">
          <span class="html-link">Read more...</span>
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

