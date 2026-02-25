import { Component, OnInit } from '@angular/core';
import { SEOService } from '@shared/services/seo.service';
import { SchemaFAQPage } from '@shared/types';

@Component({
  standalone: true,
  selector: 'app-faq',
  templateUrl: './faq.component.html',
  styleUrls: ['../home.component.css']
})
export class FAQComponent implements OnInit {

  constructor(private _seo: SEOService) {}

  pageHeading = 'Frequently Asked Questions';
  pageDescription = 'Here are some of the most common questions we get asked about snorkelling in Britain. If you have a question that isn\'t answered here, please get in touch and we\'ll do our best to answer it and add it to this page.';
  faqs = [
    {
      question: 'Is it too cold to snorkel in Britain?',    
      answer: 'Not at all. In the summer the water temperature can reach 20°C or higher in the south of England. A wetsuit is recommended for year-round snorkelling or colder months, and cold water swimming can have beneficial health effects.'
    },
    { 
      question: 'Is there any marine life to see snorkelling in Britain?',
      answer: 'Yes! The British coastline is one of the most rich and diverse marine habitats in the world. You could see great spider crabs, small-spotted catsharks, tompot blenny, sea slugs, ballan wrasse, and many other species.'
    },
    {
      question: 'Is snorkelling in Britain safe?',  
      answer: 'Snorkelling comes with risks but can be enjoyed safely by developing skills slowly, testing kit in a pool first, and progressing to shallow sheltered water sites. Professional instruction through organisations like BSAC is recommended.'
    },
    {
      question: 'What are the best snorkelling sites in Britain?',  
      answer: 'The most abundant locations tend to be those with rocky seabed and healthy currents. Always check tides and currents before visiting. Our book "Snorkelling Britain" features 100 favourite snorkelling sites in England, Scotland and Wales.'
    },
    {
      question: 'Is it "snorkelling" or "snorkeling"?',  
      answer: 'The Oxford English Dictionary gives "snorkelling" as the correct spelling in British English.'
    },
    {
      question: 'How did you find the name Snorkelology?',  
      answer: 'We wanted a made-up name so it would be easy to find a domain name. It is a compound of "snorkel" and the ending "-ology", like dendrochronology.'
    }
  ];

  ngOnInit() {
    const faqSchema: SchemaFAQPage = {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: this.faqs.map(faq => ({
        '@type': 'Question',
        name: faq.question,
        acceptedAnswer: {
          '@type': 'Answer',
          text: faq.answer
        }
      }))
    };
    
    this._seo.addFAQPageSchema(faqSchema);
  }

}
