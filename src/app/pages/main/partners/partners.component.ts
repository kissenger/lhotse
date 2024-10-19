import { Component } from '@angular/core';
import { NgOptimizedImage } from '@angular/common';
import { ImageCollection } from '../../../shared/types';
import { ImageService } from '../../../shared/services/image.service';
import { imageCollection } from '../../../shared/db-images';

@Component({  
  standalone: true,
  imports: [NgOptimizedImage],
  selector: 'app-partners',
  templateUrl: './partners.component.html',
  styleUrls: ['./partners.component.css']
})
export class PartnersComponent {

  private _imgs: ImageCollection = imageCollection;
  private _partners: any[] = [];
  public partnerImages;

  constructor(
    private images: ImageService
  ) {

    for (let key in this._imgs) {
      if (this._imgs[key].type === 'partner') {
        this._partners.push(images.sizedImage(key, 'small'));
      }
    }

    this.partnerImages = this._partners
      .map( value => ( { value, sort: Math.random() } ))
      .sort( (a, b) => a.sort - b.sort)
      .map(({ value }) => value)
  }

}
