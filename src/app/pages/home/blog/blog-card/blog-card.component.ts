import { Component, Input } from '@angular/core';
import { CommonModule, NgOptimizedImage } from '@angular/common';
import { BlogPost } from '@shared/types';
import { RouterLink } from '@angular/router';
import { environment } from '@environments/environment';

@Component({
  standalone: true,
  imports: [NgOptimizedImage, CommonModule, RouterLink],
  selector: 'app-blog-card',
  templateUrl: './blog-card.component.html',
  styleUrls: ['./blog-card.component.css'],
})

export class BlogCardComponent {
  @Input() public data: BlogPost = new BlogPost;
}

