import { Component, OnInit } from '@angular/core';
import { ImageService } from '../../../shared/services/image.service';
import { NgOptimizedImage, provideImgixLoader } from '@angular/common';

@Component({
  standalone: true,
  providers: provideImgixLoader('https://snorkelology.imgix.net'),
  imports: [NgOptimizedImage],
  selector: 'app-about',
  templateUrl: './about.component.html',
  styleUrls: ['../main.component.css']
})
export class AboutUsComponent implements OnInit {

  constructor(
    public images: ImageService
  ) { }

  ngOnInit(): void {
  }

}
