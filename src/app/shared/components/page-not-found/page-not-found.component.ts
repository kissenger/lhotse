import { Component, OnInit } from '@angular/core';
import { Title } from '@angular/platform-browser';

@Component({
  standalone: true,
  imports: [],
  selector: 'app-page-not-found',
  templateUrl: './page-not-found.component.html',
  styleUrls: ['./page-not-found.component.css']
})
export class PageNotFoundComponent implements OnInit {
  constructor(private _title: Title) {}

  ngOnInit() {
    this._title.setTitle('Page not found - Snorkelology');
  }
}
