import { Component } from '@angular/core';
import { NgOptimizedImage } from '@angular/common';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { stage } from '@shared/globals';

@Component({
  standalone: true,
  imports: [NgOptimizedImage],
  selector: 'app-book',
  templateUrl: './book.component.html',
  styleUrls: ['../home.component.css', './book.component.css']
})

export class BookComponent {
  public stage = stage;
  public isVideoLoaded = false;
  public readonly youtubeEmbedUrl: SafeResourceUrl;

  constructor(private readonly sanitizer: DomSanitizer) {
    this.youtubeEmbedUrl = this.sanitizer.bypassSecurityTrustResourceUrl(
      'https://www.youtube-nocookie.com/embed/nglkG5wdsmY?controls=0&mute=1&autoplay=1&loop=1&playlist=nglkG5wdsmY'
    );
  }

  loadVideo() {
    this.isVideoLoaded = true;
  }
}


