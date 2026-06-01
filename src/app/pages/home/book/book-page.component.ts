import { Component } from '@angular/core';
import { BookComponent } from '@pages/home/book/book.component';

@Component({
  standalone: true,
  imports: [BookComponent],
  template: `
    <main class="route-shell">
      <section class="route-shell-header dynamic-container">
        <h1>Snorkelling Britain</h1>
      </section>
      <section class="route-shell-content">
        <app-book></app-book>
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
export class BookPageComponent {}