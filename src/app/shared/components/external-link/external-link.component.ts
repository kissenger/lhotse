import { Component, Input } from '@angular/core';

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
        width="1em"
        height="1em"
        preserveAspectRatio="xMidYMid meet"
        viewBox="0 0 20 20">
        <path d="M9 3h8v8l-2-1V6.92l-5.6 5.59l-1.41-1.41L14.08 5H10zm3 12v-3l2-2v7H3V6h8L9 8H5v7h7z" stroke-width="0.5px" stroke="#FFFFFF" fill="#009AF7" />
      </svg>
    </a>
  `,
  styles: [".ext-link {display: inline-flex; flex-direction: row;}"],
})

export class ExternalLinkComponent  {
  @Input() public link = '';
  @Input() public text = '';

  constructor(
  ) { }

}
