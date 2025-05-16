import { Component } from '@angular/core';
import { PagesComponent } from './pages/pages.component';

@Component({
  standalone: true,
  providers: [],
  imports: [PagesComponent],
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent  {
 
}
