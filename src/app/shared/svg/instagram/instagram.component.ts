import { Component, ChangeDetectionStrategy } from '@angular/core';
import { ThemedSvgBase } from '../themed-svg.base';

@Component({
  standalone: true,
  selector: 'app-svg-instagram',
  changeDetection: ChangeDetectionStrategy.Eager,
  templateUrl: './instagram.component.html'
})

export class InstagramSvgComponent extends ThemedSvgBase {
  public fillColour?: string;

  ngOnInit() {
    this.setDefaultHeight('30px');
    this.fillColour = this.primaryColour;
  }

}