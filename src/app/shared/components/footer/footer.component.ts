import { ScreenService } from '../../services/screen.service';
import { Component} from '@angular/core';
import { ImageService } from '../../services/image.service';
import { NgOptimizedImage } from '@angular/common';
import { RouterLink } from '@angular/router';

@Component({
  standalone: true,
  imports: [NgOptimizedImage, RouterLink],
  selector: 'app-footer',
  templateUrl: './footer.component.html',
  styleUrls: ['./footer.component.css']
})
export class FooterComponent{

  public fullYear?: number;
  public logos;
  private _logoNames = ['instagram', 'email'];

  constructor(
    public screen: ScreenService,
    private _images: ImageService
  ) { 

    this.fullYear = new Date().getFullYear();
    this.logos = this._logoNames.map( (ln: string) => {
      return this._images.sizedImage(ln, 'small')
    })
  }
}
