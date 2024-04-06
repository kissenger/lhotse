import { Component } from '@angular/core';
import { NgOptimizedImage, provideImgixLoader } from '@angular/common';
import { NavService } from '../../../shared/services/nav.service';
import { ImageService } from '../../../shared/services/image.service';
import { ExtLinkComponent } from '../../../shared/components/ext-link/ext-link.component';
import { environment } from '@environments/environment';

@Component({
  standalone: true,
  providers: provideImgixLoader(`https://${environment.IMGIX_DOMAIN}`),
  imports: [NgOptimizedImage, ExtLinkComponent],
  selector: 'app-science-part-one',
  templateUrl: './science-part-one.component.html',
  styleUrls: ['../content.component.css'],
})

export class SciencePartOneComponent  {

  constructor(
    public navigate: NavService,
    public images: ImageService
  ) {
  }
}
