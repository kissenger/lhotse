import { Component, OnInit } from '@angular/core';
import { ImageService } from '../../../shared/services/image.service';
import { NgOptimizedImage, provideImgixLoader } from '@angular/common';
import { environment } from '@environments/environment';
import { ExternalLinkComponent } from '@shared/components/external-link/external-link.component';

@Component({
  standalone: true,
  providers: provideImgixLoader(`https://${environment.IMGIX_DOMAIN}`),
  imports: [ExternalLinkComponent, NgOptimizedImage],
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
