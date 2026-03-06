import { Component } from '@angular/core';
import { ThemedSvgBase } from '../themed-svg.base';

@Component({
  standalone: true,
  selector: 'app-svg-close-icon',
  templateUrl: './closeIcon.component.html'
})

export class CloseIconSvgComponent extends ThemedSvgBase {
  public strokeColour?: string;

  ngOnInit() {
    this.setDefaultHeight('10px');
    this.strokeColour = this.primaryColour;
  }

}