import { CommonModule } from '@angular/common';
import { Component, Input} from '@angular/core';

@Component({
  selector: 'app-svg-arrow',
  standalone: true,
  providers: [],
  template: `
  <div  id="arrow" class="arrow" [ngClass]="direction=='left'?'left':'right'" >
    <svg [ngClass]="direction=='left'?'left':'right'" viewBox="-5 -5 50 50" height="40px" width="40px" version="1.1" xmlns="http://www.w3.org/2000/svg">
      <path fill="#FFFFFF" stroke="#1D3D59" stroke-width="3" d="m0 20a2.6667 2.6667 90 0040 0 2.6667 2.6667 90 00-40 0" pointer-events="none"/>
      <path fill="#FFFFFF" stroke="#1D3D59" stroke-width="4" stroke-linecap="round" d="M16 8 28 20 16 32" pointer-events="none"/>
    </svg>
  </div>
  `,
  styleUrls: ['./svg-arrow.component.css'],
  imports: [CommonModule]
})

export class SvgArrowComponent {
    @Input() public direction: 'left' | 'right' = 'left';   
}