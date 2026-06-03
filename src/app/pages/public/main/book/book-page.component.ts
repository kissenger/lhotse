import { Component } from '@angular/core';
import { BookComponent } from '@pages/public/main/book/book.component';
import { PageShellComponent } from '@shared/components/page-shell/page-shell.component';

@Component({
  standalone: true,
  imports: [BookComponent, PageShellComponent],
  template: `
    <app-page-shell heading="Snorkelling Britain">
      <app-book></app-book>
    </app-page-shell>`
})
export class BookPageComponent {}