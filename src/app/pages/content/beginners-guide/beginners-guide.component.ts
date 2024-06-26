import { Component } from '@angular/core';
import { NgOptimizedImage, provideImgixLoader } from '@angular/common';
import { NavService } from '../../../shared/services/nav.service';
import { ImageService } from '../../../shared/services/image.service';
import { ExtLinkComponent } from '../../../shared/components/ext-link/ext-link.component';
import { environment } from '@environments/environment';
import { Meta } from '@angular/platform-browser';

@Component({
  standalone: true,
  providers: provideImgixLoader(`https://${environment.IMGIX_DOMAIN}`),
  imports: [NgOptimizedImage, ExtLinkComponent],
  selector: 'app-beginners-guide',
  templateUrl: './beginners-guide.component.html',
  styleUrls: ['../content.component.css'],
})

export class BeginnersGuideComponent  {

  constructor(
    public navigate: NavService,
    public images: ImageService,
    private meta: Meta
  ) {
      const canonicalTag = this.meta.getTag('rel="canonical"');
      console.log(canonicalTag)
      // if (canonicalTag) {
      //   this.meta.updateTag({ rel: 'canonical', href: 'ballsacks' });
      // } else {
      //   this.meta.addTag({ rel: 'canonical', href: 'ballsacks' });
      // }
    
  }
}