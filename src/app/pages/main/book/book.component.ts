import { Component, OnInit } from '@angular/core';
import { ImageService } from '../../../shared/services/image.service';
import { NgOptimizedImage } from '@angular/common';
import { BannerAdComponent } from '@shared/components/banner-ad/banner-ad.component';

@Component({
  standalone: true,
  providers: [],
  imports: [NgOptimizedImage, BannerAdComponent],
  selector: 'app-book',
  templateUrl: './book.component.html',
  styleUrls: ['../main.component.css']
})

export class BookComponent implements OnInit {

  constructor(
    public images: ImageService,
  ) { }

  ngOnInit(): void {
  }


}
