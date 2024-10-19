import { Component} from '@angular/core';
import { NavService } from '@shared/services/nav.service';
import { BlogBrowserComponent } from '@pages/blog/browser/browser.component';
import { ExternalLinkComponent } from '@shared/components/external-link/external-link.component';

@Component({
  standalone: true,
  imports: [BlogBrowserComponent, ExternalLinkComponent],
  selector: 'app-explore',
  templateUrl: './explore.component.html',
  styleUrls: ['../main.component.css'],
})

export class ExploreComponent {

  constructor(
    public navigate: NavService
  ) {}

}
