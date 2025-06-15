import { Component} from '@angular/core';
import { BlogBrowserComponent } from './blog-browser/browser.component';

@Component({
  standalone: true,
  imports: [BlogBrowserComponent],
  selector: 'app-blog',
  templateUrl: './blog.component.html',
  styleUrls: ['../main.component.css'],
})

export class BlogComponent {

  constructor(
  ) {}

}
