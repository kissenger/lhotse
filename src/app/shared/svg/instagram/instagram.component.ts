import { Component, Input } from '@angular/core';

@Component({
  standalone: true,
  selector: 'app-svg-instagram',
  templateUrl: './instagram.component.html'
})

export class InstagramSvgComponent { 
  @Input() public theme?: 'lightOnDark' | 'darkOnLight';
  public fillColour?: string;

  constructor() {
  }

  ngOnInit() {
    this.fillColour = this.theme === 'lightOnDark' ? '#FFFFFF' : '#1D3D59';
  }

}