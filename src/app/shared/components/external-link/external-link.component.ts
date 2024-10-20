import { Component, Input } from '@angular/core';
// fill="#009AF7"
@Component({
  selector: 'app-external-link',
  standalone: true,
  template: `

    <a class="ext-link html-link" href={{link}} role="link">
      {{text}}
      
      <svg
        xmlns="http://www.w3.org/2000/svg"
        xmlns:xlink="http://www.w3.org/1999/xlink"
        aria-hidden="true"
        role="img"
        height=0.8em
        width=0.8em

        viewBox="-5 -5 34 34">
        <!-- <path d="M9 3h8v8l-2-1V6.92l-5.6 5.59l-1.41-1.41L14.08 5H10zm3 12v-3l2-2v7H3V6h8L9 8H5v7h7z" stroke=#009AF7 stroke-width="0.1%" /> -->
        <path d="M14 0H24V10M24 0 8 16M12 4h-12V24H20v-12" stroke=#009AF7 stroke-width="1" fill="none" 
        vector-effect="non-scaling-stroke" stroke-linecap="round" shape-rendering="crispEdges" />
      </svg>
    </a>
  `,
  styles: [".ext-link {display: inline-flex; flex-direction: row;}"],
})

export class ExternalLinkComponent  {
  @Input() public link = '';
  @Input() public text = '';
  @Input() public colour = '#009AF7' ;

  constructor(
  ) { }

}
