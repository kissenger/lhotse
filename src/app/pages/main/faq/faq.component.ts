import { Component, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  standalone: true,
  imports: [RouterLink],
  selector: 'app-faq',
  templateUrl: './faq.component.html',
  styleUrls: ['../main.component.css']
})
export class FAQComponent implements OnInit {

  constructor(
  ) { }

  ngOnInit(): void {
  }

}
