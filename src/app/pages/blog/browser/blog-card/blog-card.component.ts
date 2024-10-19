import { Component, Input, ViewEncapsulation } from '@angular/core';
import { CommonModule, NgOptimizedImage } from '@angular/common';
import { NavService } from '@shared/services/nav.service';
import { BlogPost } from '@shared/types';

@Component({
  standalone: true,
  imports: [NgOptimizedImage, CommonModule],
  selector: 'app-blog-card',
  template: `
    <div class="blog-card stealth-html-link" (click)="navigate.to('blog/article/'+data.slug)">
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
          <a class="html-link" role="link">Read more...</a>
        </div>
      </div>
    </div>
  `,
  styleUrls: ['./blog-card.component.css'],
  encapsulation: ViewEncapsulation.None,
})

export class BlogCardComponent {
  @Input() public data: BlogPost = new BlogPost;

  constructor(
    public navigate: NavService
  ) {}
}
