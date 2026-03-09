import { Component } from '@angular/core';
import { ThemedSvgBase } from '../themed-svg.base';

@Component({
  standalone: true,
  selector: 'app-svg-email',
  templateUrl: './email.component.html'
})

export class EmailSvgComponent extends ThemedSvgBase {
  public fillColour?: string;
  public strokeColour?: string;

  ngOnInit() {
    this.setDefaultHeight('25px');
    this.strokeColour = this.primaryColour;
    this.fillColour = this.inverseColour;
  }

}