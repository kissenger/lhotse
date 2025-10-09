import { Component, Input } from '@angular/core';

@Component({
  standalone: true,
  selector: 'app-svg-youtube',
  templateUrl: './youtube.component.html'
})

export class YoutubeSvgComponent { 
  @Input() public theme?: 'lightOnDark' | 'darkOnLight';
  @Input() public height?: string;
  public fillColour?: string;

  constructor() {
  }

  ngOnInit() {
    this.height = this.height ?? '30px';
    console.log(this.height)
    this.fillColour = this.theme === 'lightOnDark' ? '#FFFFFF' : '#1D3D59';
  }

}