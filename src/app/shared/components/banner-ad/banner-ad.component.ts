import { NgOptimizedImage } from '@angular/common';
import { Component} from '@angular/core';

@Component({
  standalone: true,
  imports: [NgOptimizedImage],
  selector: 'app-banner-ad',
  template: `
      @if (insert) {
        <a 
          class="suppress-external-link" 
          href="https://www.amazon.co.uk/Snorkelling-Britain-adventures-explorers-Adventures/dp/1910636479/ref=sr_1_1?crid=33Z6ZCOT2QQU3&dib=eyJ2IjoiMSJ9.-3C-N7lrE3HtGgcTR3BuH3E5up9BJHUb6NMZ-5sS19ubYtwem3-hCBbrX1bxDERnCAn62LN1bUv8KZGUUoHasaj0hwlwR0pL9hRrQXQr0E8.tlmqcT2BIzxscmZpcbUk3U6j_GSl0WsErdNeKaimPhY&dib_tag=se&keywords=snorkelling+britain&nsdOptOutParam=true&qid=1729858365&sprefix=snorkelling+britain%2Caps%2C93&sr=8-1">
          <div>
            <img
            ngSrc = "ads/snorkelling-britain-preorder-now-banner.jpg"
            alt   = "Snorkelling Britain: 100 Marine Adventures book cover"
            fill
          /> 
          </div>
        </a>
      }
  `,
  styles: ` div{overflow:hidden;position:relative;height:110px;width:100%;margin-block:1em;} 
            div>img{width:100%;height:100%;object-fit:cover;object-position:center;}
            @media (max-width: 575px) {div{height:70px;}}
          `
})

export class BannerAdComponent{

  public insert: boolean = false;

  constructor(
  ) { 
    // this.insert = Math.random() > 0.7;
    this.insert = true;
  }

}
