import { Component, Input } from '@angular/core';

@Component({
  standalone: true,
  selector: 'app-svg-email',
  templateUrl: './email.component.html'
})

export class EmailSvgComponent { 
  @Input() public theme?: 'lightOnDark' | 'darkOnLight';
  public fillColour?: string;
  public strokeColour?: string;

  constructor() {
  }

  ngOnInit() {
    this.strokeColour = this.theme === 'lightOnDark' ? '#FFFFFF' : '#1D3D59';
    this.fillColour = this.theme === 'lightOnDark' ? '#1D3D59' : '#FFFFFF';
  }

}