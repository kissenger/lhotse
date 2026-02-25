import { Component, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SEOService, SchemaFAQPage } from '@shared/services/seo.service';

@Component({
  standalone: true,
  imports: [RouterLink],
  selector: 'app-faq',
  templateUrl: './faq.component.html',
  styleUrls: ['../home.component.css']
})
export class FAQComponent implements OnInit {

  constructor(private _seo: SEOService) {}

  ngOnInit() {
    const faqSchema: SchemaFAQPage = {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: [
        {
          '@type': 'Question',
          name: 'Is it too cold to snorkel in Britain?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'Not at all. In the summer the water temperature can reach 20°C or higher in the south of England. A wetsuit is recommended for year-round snorkelling or colder months, and cold water swimming can have beneficial health effects.'
          }
        },
        {
          '@type': 'Question',
          name: 'Is there any marine life to see snorkelling in Britain?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'Yes! The British coastline is one of the most rich and diverse marine habitats in the world. You could see great spider crabs, small-spotted catsharks, tompot blenny, sea slugs, ballan wrasse, and many other species.'
          }
        },
        {
          '@type': 'Question',
          name: 'Is snorkelling in Britain safe?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'Snorkelling comes with risks but can be enjoyed safely by developing skills slowly, testing kit in a pool first, and progressing to shallow sheltered water sites. Professional instruction through organisations like BSAC is recommended.'
          }
        },
        {
          '@type': 'Question',
          name: 'What are the best snorkelling sites in Britain?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'The most abundant locations tend to be those with rocky seabed and healthy currents. Always check tides and currents before visiting. Our book "Snorkelling Britain" features 100 favourite snorkelling sites in England, Scotland and Wales.'
          }
        },
        {
          '@type': 'Question',
          name: 'Is it "snorkelling" or "snorkeling"?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'The Oxford English Dictionary gives "snorkelling" as the correct spelling in British English.'
          }
        },
        {
          '@type': 'Question',
          name: 'How did you find the name Snorkelology?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'We wanted a made-up name so it would be easy to find a domain name. It is a compound of "snorkel" and the ending "-ology", like dendrochronology.'
          }
        }
      ]
    };
    
    this._seo.addFAQPageSchema(faqSchema);
  }

}
