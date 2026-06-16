import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-affiliate-box',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="affiliate-box" role="region" aria-label="Affiliate link">
      <div class="affiliate-box__label">AFFILIATE LINK</div>
      <a class="affiliate-box__link" [href]="link" target="_blank" rel="nofollow noopener noreferrer">{{ linkText || link }}</a>
      @if (statement) {
        <p class="affiliate-box__statement">
          {{ statement }}
          <a class="anchor-pill cta-link-btn affiliate-box__learn-more" routerLink="/affiliate-disclosure">Learn more</a>
        </p>
      }
    </div>
  `,
  styles: [`
    .affiliate-box {
      width: 100%;
      box-sizing: border-box;
      padding: 1rem 1.1rem;
      display: grid;
      gap: 0.45rem;
      border-radius: 10px;
      background: var(--surface-soft, #f7fbff);
      border: 1px solid var(--border-soft, #d7e3ee);
      box-shadow: 0 12px 24px -22px rgba(29, 61, 89, 0.45);
    }

    .affiliate-box__label {
      font-variant: all-small-caps;
      font-size: 0.75rem;
      color: var(--text-subtle, rgba(0,0,0,0.45));
      letter-spacing: 0.06em;
    }

    .affiliate-box__link {
      color: var(--text-colour-link, #0066cc);
      text-decoration: none;
      border-bottom: 1px dotted rgba(0, 102, 204, 0.5);
      border-radius: 2px;
      padding-bottom: 1px;
      overflow-wrap: anywhere;
      line-height: 1.4;
      width: fit-content;
      max-width: 100%;
    }

    .affiliate-box__statement {
      margin: 0;
      color: var(--text-muted, rgba(0,0,0,0.6));
      font-size: 0.95rem;
      line-height: 1.5;
    }

    .affiliate-box__learn-more {
      margin-left: 0.55rem;
      vertical-align: middle;
      white-space: nowrap;
    }
  `]
})
export class AffiliateBoxComponent {
  @Input() link = '';
  @Input() linkText = '';
  @Input() statement = 'We may earn a commission from qualifying purchases made through this link, at no extra cost to you.  Making a purchase in this way helps to support the site.';
}
