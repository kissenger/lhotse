import { Component } from '@angular/core';
import { faqItems } from '../../../shared/faq-data';

@Component({
  standalone: true,
  selector: 'app-faq',
  templateUrl: './faq.component.html',
  styleUrls: ['../home.component.css']
})
export class FAQComponent {
  constructor() {}

  pageHeading = 'Frequently Asked Questions';
  pageDescription = 'Here are some of the most common questions we get asked about snorkelling in Britain. If you have a question that isn\'t answered here, please get in touch and we\'ll do our best to answer it and add it to this page.';
  faqs = faqItems;

}
