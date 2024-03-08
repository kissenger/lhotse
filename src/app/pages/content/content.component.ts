import { NavService } from '../../shared/services/nav.service';
import { Component } from '@angular/core';
import { ContentBrowserComponent } from '../../shared/components/content-browser/content-browser.component';

@Component({
  standalone: true,
  imports: [ContentBrowserComponent],
  selector: 'app-content',
  templateUrl: './content.component.html',
  styleUrls: ['./content.component.css'],
})

export class ContentComponent  {
  constructor(
    public navigate: NavService
  ) { }
}
