import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { ArticlePost } from '@shared/types';
import { RouterLink } from '@angular/router';
import { appImageUrl } from '@shared/utils/image-url';
import { environment } from '@environments/environment';

@Component({
  standalone: true,
  imports: [RouterLink, DatePipe, DecimalPipe],
  selector: 'app-article-card',
  templateUrl: './article-card.component.html',
  styleUrls: ['./article-card.component.css'],
})

export class ArticleCardComponent implements OnChanges {
  @Input() public data: ArticlePost = new ArticlePost;

  private _useLocalImageFallback = false;

  get imageSrc(): string {
    const source = (this.data?.imgFname || '').trim();
    if (!source) {
      return '';
    }

    if (this._useLocalImageFallback) {
      return appImageUrl(source, { stage: 'dev' });
    }

    return appImageUrl(source, {
      stage: environment.STAGE,
      width: 560,
      format: 'webp',
      fit: 'contain',
      quality: 40,
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['data']) {
      this._useLocalImageFallback = false;
    }
  }

  onImageError(): void {
    if (!this._useLocalImageFallback) {
      this._useLocalImageFallback = true;
    }
  }
}

