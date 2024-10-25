import { NgOptimizedImage } from '@angular/common';
import { Component} from '@angular/core';

@Component({
  standalone: true,
  imports: [NgOptimizedImage],
  selector: 'app-banner-ad',
  template: `
    <div class="">
      <img class=""
        ngSrc = "ads/snorkelling-britain-preorder-now-banner.jpg"
        alt   = "Snorkelling Britain: 100 Marine Adventures book cover"
        fill
      /> 
    </div> 
  `,
  styles: ` div{overflow:hidden;position:relative;height:90px;width:100%;border:1px red solid;} 
            div>img{width:100%;height:100%;object-fit:cover;object-position:center;}
            @media (max-width: 575px) {div{height: 70px;}}
          `
})

export class BannerAdComponent{

  constructor(
  ) { 
  }
}
