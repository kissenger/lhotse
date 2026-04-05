import { Component } from '@angular/core';
import { MapComponent } from '@pages/home/map/map.component';

@Component({
  standalone: true,
  imports: [MapComponent],
  template: `
    <main>
      <h1 class="sr-only">Interactive Snorkelling Map of Britain</h1>
      <app-map></app-map>
    </main>`,
  styles: [`
    main { margin-top: var(--header-height); }
    .sr-only {
      position: absolute;
      width: 1px; height: 1px;
      padding: 0; margin: -1px;
      overflow: hidden;
      clip: rect(0,0,0,0);
      white-space: nowrap;
      border: 0;
    }
  `]
})
export class MapPageComponent {}
