import { Component } from '@angular/core';
import { ThemedSvgBase } from '../themed-svg.base';

@Component({
  standalone: true,
  selector: 'app-svg-facebook',
  templateUrl: './facebook.component.html'
})

export class FacebookSvgComponent extends ThemedSvgBase {
  public fillColour?: string;
  public strokeColour?: string;

  ngOnInit() {
    this.setDefaultHeight('30px');
    this.strokeColour = this.primaryColour;
    this.fillColour = this.inverseColour;
  }

}