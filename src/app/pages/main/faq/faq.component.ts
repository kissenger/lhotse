import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  standalone: true,
  imports: [RouterLink],
  selector: 'app-faq',
  templateUrl: './faq.component.html',
  styleUrls: ['../main.component.css']
})
export class FAQComponent {

  constructor(
  ) {}

}
