import { Component } from '@angular/core';
import { ThemedSvgBase } from '../themed-svg.base';

@Component({
  standalone: true,
  selector: 'app-svg-youtube',
  templateUrl: './youtube.component.html'
})

export class YoutubeSvgComponent extends ThemedSvgBase {
  public fillColour?: string;

  ngOnInit() {
    this.setDefaultHeight('30px');
    this.fillColour = this.primaryColour;
  }

}