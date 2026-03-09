import { Component } from '@angular/core';
import { CarouselComponent } from '@shared/components/carousel/carousel.component';
import { CarouselImages } from '@shared/types';

@Component({
  standalone: true,
  imports: [ CarouselComponent],
  providers: [],
  selector: 'app-slideshow',
  templateUrl: './slideshow.component.html',
  styleUrls: ['./slideshow.component.css']
})

export class SlideshowComponent {

  public slideshowImages: CarouselImages = [{
    src: "photos/slideshow/child-walking-beach-after-snorkelling-in-yorkshire-england-britain-5.jpg",
    alt: "Photo of child walking up a beach holding snorkelling gear with blue-green sea behind",
    textbox: {
      header: "Welcome to Snorkelology",
      text: "Discover the wonders of British snorkelling for all the family"
    },
    priority: true
  },{
    src: "photos/slideshow/drone-shot-of-woman-snorkelling-with-book-cover-overlaid.jpg",
    alt: "Snorkelling Britain book cover with drone view of woman snorkelling behind",
    textbox: {
      header: "Snorkelling Britain",
      text: "Find out about our new guidebook to 100 British snorkelling sites"
    }
  },{
    src: "photos/slideshow/children-rock-pool-snorkelling-in-cornwall-britain.jpg",
    alt: "Photo showing children pointing at marine life while snorkelling in a rock pool",
    textbox: {
      header: "Learn about British snorkelling",
      text: "Explore our content to discover a fascinating underwater world"
    },
  }]

  constructor(
  ) {
  }
}