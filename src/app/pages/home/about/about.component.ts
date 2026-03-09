import { Component } from '@angular/core';
import { NgOptimizedImage } from '@angular/common';

@Component({
  standalone: true,
  providers: [],
  imports: [NgOptimizedImage],
  selector: 'app-about',
  templateUrl: './about.component.html',
  styleUrls: ['../home.component.css']
})

export class AboutUsComponent {

  constructor(
  ) { }

}
