import { NavService } from '../../services/nav.service';
import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-ext-link',
  standalone: true,
  template: `
    <span class="ext-link html-link" (click)="navigate.to(link)" role="link">
      {{text}}
      <svg
        xmlns="http://www.w3.org/2000/svg"
        xmlns:xlink="http://www.w3.org/1999/xlink"
        aria-hidden="true"
        role="img"
        width="1em"
        height="1em"
        preserveAspectRatio="xMidYMid meet"
        viewBox="0 0 20 20">
        <path d="M9 3h8v8l-2-1V6.92l-5.6 5.59l-1.41-1.41L14.08 5H10zm3 12v-3l2-2v7H3V6h8L9 8H5v7h7z" stroke-width="0.5px" stroke="#FFFFFF" fill="#009AF7" />
      </svg>
      </span>
  `,
  styles: [".ext-link {display: inline-flex; flex-direction: row;}"],
})

export class ExtLinkComponent  {
  @Input() public link = '';
  @Input() public text = '';

  constructor(
    public navigate: NavService
  ) { }

}
