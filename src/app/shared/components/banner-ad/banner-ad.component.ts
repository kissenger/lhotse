import { NgOptimizedImage } from '@angular/common';
import { Component} from '@angular/core';

@Component({
  standalone: true,
  imports: [NgOptimizedImage],
  selector: 'app-banner-ad',
  template: `
    <div class="">
      <img class=""
        ngSrc = "photos/ads/snorkelling-britain-preorder-now-banner.jpg"
        alt   = "Snorkelling Britain: 100 Marine Adventures book cover"
        width = "728"
        height = "90"
      /> 
    </div> 
  `,
  styles: ''
})
export class BannerAdComponent{

  constructor(
  ) { 
  }
}
