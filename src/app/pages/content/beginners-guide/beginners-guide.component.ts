import { Component } from '@angular/core';
import { NgOptimizedImage, provideImgixLoader } from '@angular/common';
import { NavService } from '../../../shared/services/nav.service';
import { ImageService } from '../../../shared/services/image.service';
import { ExtLinkComponent } from '../../../shared/components/ext-link/ext-link.component';

@Component({
  standalone: true,
  providers: provideImgixLoader('https://snorkelology.imgix.net'),
  imports: [NgOptimizedImage, ExtLinkComponent],
  selector: 'app-beginners-guide',
  templateUrl: './beginners-guide.component.html',
  styleUrls: ['../content.component.css'],
})

export class BeginnersGuideComponent  {

  constructor(
    public navigate: NavService,
    public images: ImageService
  ) { }
  
}