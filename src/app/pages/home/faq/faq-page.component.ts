import { Component } from '@angular/core';
import { FAQComponent } from '@pages/home/faq/faq.component';

@Component({
  standalone: true,
  imports: [FAQComponent],
  template: `
    <main class="route-shell">
      <section class="route-shell-header dynamic-container">
        <h1>British Snorkelling FAQs</h1>
      </section>
      <section class="route-shell-content">
        <app-faq></app-faq>
      </section>
    </main>`,
  styles: [`
    .route-shell {
      margin-top: calc(var(--header-height) + var(--header-overhang));
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
export class FaqPageComponent {}