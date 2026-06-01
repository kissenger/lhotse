import { Component } from '@angular/core';
import { MapComponent } from '@pages/home/map/map.component';
import { PageShellComponent } from '@shared/components/page-shell/page-shell.component';

@Component({
  standalone: true,
  imports: [MapComponent, PageShellComponent],
  template: `
    <app-page-shell heading="Snorkelling Map of Britain">
      <app-map></app-map>
    </app-page-shell>`
})
export class MapPageComponent {}
