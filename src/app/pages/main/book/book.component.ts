import { Component, OnInit } from '@angular/core';
import { BasketComponent } from "../basket/basket.component";

@Component({
  standalone: true,
  providers: [],
  // imports: [BasketComponent],
  selector: 'app-book',
  templateUrl: './book.component.html',
  styleUrls: ['../main.component.css']
})

export class BookComponent implements OnInit {

  constructor(
  ) { }

  ngOnInit(): void {
  }


}
