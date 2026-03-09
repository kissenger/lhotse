import { Component } from '@angular/core';
import { NgOptimizedImage } from '@angular/common';
import { stage } from '@shared/globals';

@Component({
  standalone: true,
  providers: [],
  imports: [NgOptimizedImage],
  selector: 'app-book',
  templateUrl: './book.component.html',
  styleUrls: ['../home.component.css', './book.component.css']
})

export class BookComponent {
  public stage = stage;
}


