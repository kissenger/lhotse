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
      name: 'The Ocean Studio',
      url: "partners/ocean-studio-logo.avif",
      href: 'https://www.theoceanstudio.co.uk/',
      alt: 'The Ocean Studio Logo',
      description: 'Award-winning underwater photographer and author of Snorkel Dorset, a guide to the best snorkelling sites along the Dorset coast.',
    },    
    {
      name: 'Marla Blue',
      url: "partners/marla_logo.webp",
      href: 'https://www.marla.blue/',
      alt: 'Marla Blue Logo',
      description: 'Marla Blue is a new app which gives marine visibility forecasts around the UK, helping snorkellers and divers find the best conditions for exploring underwater.',
    },
    {
      name: 'BSAC',
      url: "partners/bsac-logo.webp",
      href: 'https://www.bsac.com/',
      alt: 'British Sub Aqua Club Logo',
      description: 'The UK\'s national governing body for scuba diving and snorkelling, offering training, clubs and events nationwide.',
    },
    {
      name: 'Chris Taylor Photography',
      url: "partners/christaylorphoto-small.webp",
      href: 'https://www.christaylorphoto.co.uk',
      alt: 'Chris Taylor Photo Logo',
      description: 'Norfolk based award-winning underwater and wildlife photographer featured in publications including National Geographic, BBC Wildlife and The Guardian.',
    },
    {
      name: 'Rebecca Douglas Photography',
      url: "partners/rebecca-douglas-small.webp",
      href: 'https://rebeccadouglas.co.uk/',
      alt: 'Rebecca Douglas Photography Logo',
      description: 'Photographer, filmmaker and drone operator specializing in capturing the wild edges of earth, sea and sky.',
    },
    {
      name: 'Wild Running',
      url: "partners/wild-running-jacket-cover-small.webp",
      href: 'https://jenandsimbenson.co.uk/',
      alt: 'Wild Running by Sim and Jen Benson',
      description: 'Jen and Sim are authors of Wild Running and many other outdoor adventure guides, and were the inspiration for our book writing journey.',
    },
    {
      name: 'Wild Things Publishing',
      url: "partners/wild-things-publishing-small.webp",
      href: 'https://wildthingspublishing.com',
      alt: 'Wild Things Publishing Logo',
      description: 'Independent publisher of outdoor adventure guides including the popular Wild Guide series, and publisher of Snorkelling Britain.',
    },
    {
      name: 'Jethro Haynes Photography',
      url: "partners/jethro-haynes-small.png",
      href: 'https://www.jethrophoto.com/',
      alt: 'Jethro Haynes Photography Logo',
      description: 'Professional underwater photographer documenting marine wildlife and coastal environments across the UK.',
    },
    {
      name: 'St Martin\'s Watersports',
      url: "partners/St Martins Watersports Logo Navy-small.webp",
      href: 'https://www.stmartinswatersports.co.uk/',
      alt: 'St Martin\'s Watersports Logo',
      description: 'Guided snorkelling and watersports experiences in the Isles of Scilly, one of the UK\'s best snorkelling destinations.',
    },
    {
      name: 'Snorkel Wild',
      url: "partners/snorkelwild-small.webp",
      href: 'https://www.snorkelwild.com/',
      alt: 'Snorkel Wild Logo',
      description: 'Snorkel Wild offer guided snorkelling adventures based around in Eyemouth and Coldingham in the Scottish South East.',
    },
    {
      name: 'Macduff Marine Aquarium',
      url: "partners/aquarium-logo-small.jpg",
      href: 'https://www.macduff-aquarium.org.uk/',
      alt: 'Macduff Marine Aquarium Logo',
      description: 'Award-winning aquarium in Aberdeenshire showcasing the marine life of the Moray Firth and north-east Scotland.',
    },
    {
      name: 'Scottish Seabird Centre',
      url: "partners/logo-seabird-centre-small.png",
      href: 'https://www.seabird.org/',
      alt: 'Scottish Seabird Centre Logo',
      description: 'Marine conservation and education charity based in North Berwick, dedicated to protecting Scotland\'s marine wildlife and host to a wonderful snorkel trail.',
    },
    {
      name: 'Scottish Wildlife Trust',
      url: "partners/swt_logo-small.webp",
      href: 'https://snorkel.scottishwildlifetrust.org.uk/',
      alt: 'Scottish Wildlife Trust Logo',
      description: 'Scotland\'s leading nature conservation charity, running snorkel trail programmes to connect people with marine habitats.',
    },
    {
      name: 'Saltwater Life',
      url: "partners/saltwater-life-small.webp",
      href: 'https://saltwaterlife.co.uk/',
      alt: 'Saltwater Life Logo',
      description: 'Founded by the lovely Dr Lauren Smith, Saltwater Life is passionate about the study, conservation, and protection of sharks, skates, and rays.'
    },
  ]

  constructor() {
    this.partners = this.partners
      .map(value => ({ value, sort: Math.random() }))
      .sort((a, b) => a.sort - b.sort)
      .map(({ value }) => value);
  }
}
