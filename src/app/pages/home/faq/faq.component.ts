import { Component } from '@angular/core';
import { faqItems } from '../../../shared/faq-data';

@Component({
  standalone: true,
  selector: 'app-faq',
  templateUrl: './faq.component.html',
  styleUrls: ['../home.component.css']
})
export class FAQComponent {
  pageHeading = 'British Snorkelling FAQs';
  pageDescription = 'We get asked a lot of the same questions, so we\'ve pulled together the ones that come up most \u2014 everything from where to find the best snorkelling sites and what gear you\'ll need, to water temperatures and the marine life you can expect to see around the UK coastline.';
  faqs = faqItems;

}
