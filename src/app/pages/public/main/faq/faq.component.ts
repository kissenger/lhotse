import { Component } from '@angular/core';
import { FaqItem, faqFragment, faqItems } from '@shared/faq-data';
import { HtmlerPipe } from '@shared/pipes/htmler.pipe';

type FaqSection = FaqItem['section'];

@Component({
  standalone: true,
  selector: 'app-faq',
  templateUrl: './faq.component.html',
  styleUrls: ['../home/home.component.css'],
  imports: [HtmlerPipe]
})
export class FAQComponent {
  pageHeading = 'British Snorkelling FAQs';
  pageDescription = 'We get asked a lot of the same questions, so we\'ve pulled together the ones that come up most \u2014 everything from where to find the best snorkelling sites and what gear you\'ll need, to water temperatures and the marine life you can expect to see around the UK coastline.';
  faqSections: Array<{ title: string; faqs: FaqItem[] }>;
  faqFragment = faqFragment;

  constructor() {
    const groupedFaqs = new Map<FaqSection, FaqItem[]>();

    for (const faq of faqItems) {
      const sectionFaqs = groupedFaqs.get(faq.section);
      if (sectionFaqs) {
        sectionFaqs.push(faq);
      } else {
        groupedFaqs.set(faq.section, [faq]);
      }
    }

    this.faqSections = Array.from(groupedFaqs, ([title, faqs]) => ({ title, faqs }));
  }

}
