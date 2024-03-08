import { Component} from '@angular/core';
import { NavService } from '../../../shared/services/nav.service';
import { ContentBrowserComponent } from '../../../shared/components/content-browser/content-browser.component';
import { ExtLinkComponent } from '../../../shared/components/ext-link/ext-link.component';

@Component({
  standalone: true,
  imports: [ContentBrowserComponent, ExtLinkComponent],
  selector: 'app-explore',
  templateUrl: './explore.component.html',
  styleUrls: ['../main.component.css'],
})

export class ExploreComponent {

  constructor(
    public navigate: NavService
  ) {}

}
