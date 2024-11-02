import { CommonModule } from '@angular/common';
import { Component, Input} from '@angular/core';

@Component({
  selector: 'app-svg-arrow',
  standalone: true,
  providers: [],
  template: `
  <div class="arrow" [ngClass]="direction=='left'?'left':'right'" >
    <svg [ngClass]="direction=='left'?'left':'right'" viewBox="-5 -5 50 50" height="40px" width="40px" opacity="0.6">
      <animate attributeName="opacity" from="0.6" to="1" dur="0.25s" begin="mouseover" fill="freeze"></animate>
      <animate attributeName="opacity" from="1" to="0.6" dur="0.25s" begin="mouseout" fill="freeze"></animate>
      <path fill="#FFFFFF" d="m0 20a2.6667 2.6667 90 0040 0 2.6667 2.6667 90 00-40 0" pointer-events="none"/>
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