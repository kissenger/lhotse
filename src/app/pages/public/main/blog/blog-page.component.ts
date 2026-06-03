import { Component } from '@angular/core';
import { BlogComponent } from '@pages/public/main/blog/blog.component';
import { PageShellComponent } from '@shared/components/page-shell/page-shell.component';

@Component({
  standalone: true,
  imports: [BlogComponent, PageShellComponent],
  template: `
    <app-page-shell heading="British Snorkelling Articles">
      <app-blog></app-blog>
    </app-page-shell>`
})
export class BlogPageComponent {}