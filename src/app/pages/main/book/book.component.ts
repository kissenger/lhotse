import { Component, OnInit } from '@angular/core';
import { NgOptimizedImage } from '@angular/common';

// import { BasketComponent } from "../basket/basket.component";

@Component({
  standalone: true,
  providers: [],
  imports: [NgOptimizedImage],
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
