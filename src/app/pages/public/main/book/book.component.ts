import { Component } from '@angular/core';
import { NgOptimizedImage } from '@angular/common';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { RouterLink } from '@angular/router';
import { stage } from '@shared/globals';
import { buildYouTubeEmbedUrl } from '@shared/utils/youtube-url';

@Component({
  standalone: true,
  imports: [NgOptimizedImage, RouterLink],
  selector: 'app-book',
  templateUrl: './book.component.html',
  styleUrls: ['./book.component.css']
})

export class BookComponent {
  public stage = stage;
  public readonly youtubeEmbedUrl: SafeResourceUrl;

  constructor(private readonly sanitizer: DomSanitizer) {
    this.youtubeEmbedUrl = this.sanitizer.bypassSecurityTrustResourceUrl(
      buildYouTubeEmbedUrl('nglkG5wdsmY')
    );
  }

}


