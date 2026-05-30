import { Component } from '@angular/core';
import { ShopComponent } from '@pages/home/shop/shop.component';

@Component({
  standalone: true,
  imports: [ShopComponent],
  template: `
    <main class="route-shell">
      <section class="route-shell-header dynamic-container">
        <h1>Snorkelology Shop</h1>
      </section>
      <section class="route-shell-content">
        <app-shop></app-shop>
      </section>
    </main>`,
  styles: [`
    .route-shell {
      margin-top: var(--header-height);
      padding-block: 1.25rem 2rem;
    }

    .route-shell-header {
      margin-bottom: 0.75rem;
    }

    .route-shell-header h1 {
      margin: 0;
      text-align: center;
      font-size: clamp(1.8rem, 3.8vw, 2.4rem);
      line-height: 1.15;
      text-wrap: balance;
    }

    .route-shell-content {
      display: block;
    }
  `]
})
export class ShopPageComponent {}