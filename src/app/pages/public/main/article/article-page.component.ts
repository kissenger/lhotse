import { Component } from '@angular/core';
import { ArticleComponent } from '@pages/public/main/article/article.component';
import { PageShellComponent } from '@shared/components/page-shell/page-shell.component';

@Component({
  standalone: true,
  imports: [ArticleComponent, PageShellComponent],
  template: `
    <app-page-shell heading="British Snorkelling Articles">
      <app-article></app-article>
    </app-page-shell>`
})
export class ArticlePageComponent {}