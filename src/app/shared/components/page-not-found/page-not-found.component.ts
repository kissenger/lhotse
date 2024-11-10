import { Component} from '@angular/core';
import { BlogBrowserComponent } from "../../../pages/blog/browser/browser.component";

@Component({
  standalone: true,
  imports: [BlogBrowserComponent],
  selector: 'app-page-not-found',
  templateUrl: './page-not-found.component.html',
  styleUrls: ['./page-not-found.component.css']
})
export class PageNotFoundComponent{

  constructor(
  ) {
    // console.log('404') 
  }
}
