import { Component, OnInit } from '@angular/core';
import { NgOptimizedImage } from '@angular/common';

@Component({
  standalone: true,
  providers: [],
  imports: [NgOptimizedImage],
  selector: 'app-about',
  templateUrl: './about.component.html',
  styleUrls: ['../main.component.css']
})

export class AboutUsComponent implements OnInit {

  constructor(
  ) { }

  ngOnInit(): void {
  }

}
