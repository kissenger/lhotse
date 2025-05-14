import { Component, ElementRef, Input, OnChanges, QueryList, SimpleChanges, ViewChild, ViewChildren } from '@angular/core';
import { NgOptimizedImage } from '@angular/common';

// import { BasketComponent } from "../basket/basket.component";

@Component({
  standalone: true,
  providers: [],
  imports: [NgOptimizedImage],
  selector: 'app-book',
  templateUrl: './book.component.html',
  styleUrls: ['../main.component.css']
})

export class BookComponent implements OnChanges {

  @Input() loadVideo: boolean = false;
  @ViewChild('videoContainer') videoContainer!: ElementRef;

  ngOnChanges(changes: SimpleChanges) {
    // if (changes['loadVideo'].currentValue) {
    //   const videoElement = document.createElement("video");
    //   videoElement.src = "assets/videos/snorkelling-britain-promo-video-compressed.mp4";
    //   videoElement.muted = true;
    //   videoElement.loop = true;
    //   videoElement.autoplay = true;
    //   videoElement.controls = false;
    //   videoElement.style.objectFit = "cover";
    //   videoElement.style.width = "100%";
    //   videoElement.style.height = "100%";
    //   this.videoContainer.nativeElement.appendChild(videoElement);
    // }
  }


}
