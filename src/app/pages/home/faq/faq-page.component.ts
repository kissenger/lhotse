import { Component } from '@angular/core';
import { FAQComponent } from '@pages/home/faq/faq.component';
import { PageShellComponent } from '@shared/components/page-shell/page-shell.component';

@Component({
  standalone: true,
  imports: [FAQComponent, PageShellComponent],
  template: `
    <app-page-shell heading="British Snorkelling FAQs">
      <app-faq></app-faq>
    </app-page-shell>`
})
export class FaqPageComponent {}