import { Component } from '@angular/core';
import { ShopComponent } from '@pages/public/main/shop/shop.component';
import { PageShellComponent } from '@shared/components/page-shell/page-shell.component';

@Component({
  standalone: true,
  imports: [ShopComponent, PageShellComponent],
  template: `
    <app-page-shell heading="Snorkelology Shop">
      <app-shop></app-shop>
    </app-page-shell>`
})
export class ShopPageComponent {}