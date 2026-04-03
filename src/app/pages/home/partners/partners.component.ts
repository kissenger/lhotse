import { Component } from '@angular/core';

@Component({  
  standalone: true,
  selector: 'app-partners',
  templateUrl: './partners.component.html',
  styleUrls: ['./partners.component.css']
})
export class PartnersComponent {

  public partners = [
    {
      name: 'Marla Blue',
      url: "partners/marla_logo.webp",
      href: 'https://www.marla.blue/',
      alt: 'Marla Blue Logo',
      description: 'Sustainable snorkelling gear and accessories designed for comfort and performance in British waters.',
      size: { height: 60, width: 273}
    },
    {
      name: 'BSAC',
      url: "partners/bsac-logo.webp",
      href: 'https://www.bsac.com/',
      alt: 'British Sub Aqua Club Logo',
      description: 'The UK\'s national governing body for scuba diving and snorkelling, offering training, clubs and events nationwide.',
      size: { height: 100, width: 147}
    },
    {
      name: 'Chris Taylor Photography',
      url: "partners/christaylorphoto-small.webp",
      href: 'https://www.christaylorphoto.co.uk',
      alt: 'Chris Taylor Photo Logo',
      description: 'Award-winning underwater and wildlife photographer capturing the beauty of Britain\'s marine life.',
      size: { height: 100, width: 100}
    },
    {
      name: 'Rebecca Douglas Photography',
      url: "partners/rebecca-douglas-small.webp",
      href: 'https://rebeccadouglas.co.uk/',
      alt: 'Rebecca Douglas Photography Logo',
      description: 'Underwater photographer specialising in the diverse marine habitats found around the British coastline.',
      size: { height: 100, width: 274}
    },
    {
      name: 'Wild Running',
      url: "partners/wild-running-jacket-cover-small.webp",
      href: 'https://jenandsimbenson.co.uk/',
      alt: 'Wild Running by Sim and Jen Benson',
      description: 'Outdoor adventure authors Jen and Sim Benson, creators of Wild Running and champions of exploring Britain\'s landscapes.',
      size: { height: 100, width: 82}
    },
    {
      name: 'Wild Things Publishing',
      url: "partners/wild-things-publishing-small.webp",
      href: 'https://wildthingspublishing.com',
      alt: 'Wild Things Publishing Logo',
      description: 'Independent publisher of outdoor adventure guides covering wild swimming, snorkelling and exploring the British countryside.',
      size: { height: 100, width: 100}
    },
    {
      name: 'Jethro Haynes Photography',
      url: "partners/jethro-haynes-small.png",
      href: 'https://www.jethrophoto.com/',
      alt: 'Jethro Haynes Photography Logo',
      description: 'Professional underwater photographer documenting marine wildlife and coastal environments across the UK.',
      size: { height: 100, width: 100}
    },
    {
      name: 'St Martin\'s Watersports',
      url: "partners/St Martins Watersports Logo Navy-small.webp",
      href: 'https://www.stmartinswatersports.co.uk/',
      alt: 'St Martin\'s Watersports Logo',
      description: 'Guided snorkelling and watersports experiences in the Isles of Scilly, one of the UK\'s best snorkelling destinations.',
      size: { height: 89, width: 196}
    },
    {
      name: 'Snorkel Wild',
      url: "partners/snorkelwild-small.webp",
      href: 'https://www.snorkelwild.com/',
      alt: 'Snorkel Wild Logo',
      description: 'Guided snorkelling adventures exploring the rich marine life found in British coastal waters.',
      size: { height: 100, width: 100}
    },
    {
      name: 'Macduff Marine Aquarium',
      url: "partners/aquarium-logo-small.jpg",
      href: 'https://www.macduff-aquarium.org.uk/',
      alt: 'Macduff Marine Aquarium Logo',
      description: 'Award-winning aquarium in Aberdeenshire showcasing the marine life of the Moray Firth and north-east Scotland.',
      size: { height: 100, width: 161}
    },
    {
      name: 'Scottish Seabird Centre',
      url: "partners/logo-seabird-centre-small.png",
      href: 'https://www.seabird.org/',
      alt: 'Scottish Seabird Centre Logo',
      description: 'Marine conservation and education charity based in North Berwick, dedicated to protecting Scotland\'s marine wildlife.',
      size: { height: 68, width: 111}
    },
    {
      name: 'Scottish Wildlife Trust',
      url: "partners/swt_logo-small.webp",
      href: 'https://snorkel.scottishwildlifetrust.org.uk/',
      alt: 'Scottish Wildlife Trust Logo',
      description: 'Scotland\'s leading nature conservation charity, running snorkel trail programmes to connect people with marine habitats.',
      size: { height: 100, width: 256}
    },
    {
      name: 'Saltwater Life',
      url: "partners/saltwater-life-small.webp",
      href: 'https://saltwaterlife.co.uk/',
      alt: 'Saltwater Life Logo',
      description: 'Coastal adventure and marine conservation community celebrating the UK\'s saltwater environments.',
      size: { height: 100, width: 101}
    },
  ]

  constructor() {
    this.partners = this.partners
      .map(value => ({ value, sort: Math.random() }))
      .sort((a, b) => a.sort - b.sort)
      .map(({ value }) => value);
  }
}
