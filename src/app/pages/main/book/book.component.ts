import { Component, OnInit } from '@angular/core';
import { ImageService } from '../../../shared/services/image.service';
import { NavService } from '../../../shared/services/nav.service';
import { ExtLinkComponent } from '../../../shared/components/ext-link/ext-link.component';
import { NgOptimizedImage, provideImgixLoader } from '@angular/common';
import { environment } from '@environments/environment';

@Component({
  standalone: true,
  providers: provideImgixLoader(`https://${environment.IMGIX_DOMAIN}`),
  imports: [ExtLinkComponent, NgOptimizedImage],
  selector: 'app-book',
  templateUrl: './book.component.html',
  styleUrls: ['../main.component.css']
})

export class BookComponent implements OnInit {

  constructor(
    public images: ImageService,
    public navigate: NavService
  ) { }

  ngOnInit(): void {
  }


}
