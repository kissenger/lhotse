import { Component } from '@angular/core';
import { NgOptimizedImage } from '@angular/common';

@Component({
  standalone: true,
  providers: [],
  imports: [NgOptimizedImage],
  selector: 'app-book',
  templateUrl: './book.component.html',
  styleUrls: ['../main.component.css']
})

export class BookComponent {}


