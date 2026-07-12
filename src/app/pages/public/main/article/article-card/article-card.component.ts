import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ArticlePost } from '@shared/types';
import { RouterLink } from '@angular/router';
import { appImageUrl } from '@shared/utils/image-url';
import { environment } from '@environments/environment';

@Component({
  standalone: true,
  imports: [RouterLink, DatePipe],
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

  get reviewComputedRating(): number {
    const cats = this.data.review?.ratingCategories;
    if (cats?.length) {
      const avg = cats.reduce((s, c) => s + c.value, 0) / cats.length;
      return Math.round(avg * 10) / 10;
    }
    return this.data.review?.ratingValue || 0;
  }

  get ratingDisplayFormat(): string {
    return (this.data.review?.ratingCategories?.length ?? 0) > 0 ? '1.0-1' : '1.0-0';
  }

  get reviewStarScale(): number {
    const scale = Number(this.data.review?.ratingScale || 5);
    if (!Number.isFinite(scale) || scale <= 0) {
      return 5;
    }
    return Math.max(1, Math.round(scale));
  }

  get reviewStarsFillPercent(): number {
    const scale = this.reviewStarScale;
    const value = Number(this.reviewComputedRating || 0);
    const clamped = Math.max(0, Math.min(scale, value));
    return (clamped / scale) * 100;
  }

  get reviewStarsScaleArray(): number[] {
    return Array.from({ length: this.reviewStarScale }, (_, i) => i);
  }
}

