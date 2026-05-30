import { Component } from '@angular/core';
import { BlogComponent } from '@pages/home/blog/blog.component';

@Component({
  standalone: true,
  imports: [BlogComponent],
  template: `
    <main class="route-shell">
      <section class="route-shell-header dynamic-container">
        <h1>British Snorkelling Articles</h1>
      </section>
      <section class="route-shell-content">
        <app-blog></app-blog>
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
export class BlogPageComponent {}