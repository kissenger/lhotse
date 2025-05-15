import { Component} from '@angular/core';
import { BlogBrowserComponent } from './blog-browser/browser.component';

@Component({
  standalone: true,
  imports: [BlogBrowserComponent],
  selector: 'app-explore',
  templateUrl: './explore.component.html',
  styleUrls: ['../main.component.css'],
})

export class ExploreComponent {

  constructor(
  ) {}

}
