import { Component, Input } from '@angular/core';

@Component({
  standalone: true,
  selector: 'app-svg-website',
  templateUrl: './website.component.html'
})

export class WebsiteSvgComponent { 
  @Input() public theme?: 'lightOnDark' | 'darkOnLight';
  @Input() public height?: string;
  public fillColour?: string;
  public strokeColour?: string;

  constructor() {
  }

  ngOnInit() {
    this.height = this.height ?? '30px';
    this.strokeColour = this.theme === 'lightOnDark' ? '#FFFFFF' : '#1D3D59';
    this.fillColour = this.theme === 'lightOnDark' ? '#1D3D59' : '#FFFFFF';
  }

}