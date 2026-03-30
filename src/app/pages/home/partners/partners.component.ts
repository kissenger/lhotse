import { Component } from '@angular/core';

@Component({  
  standalone: true,
  selector: 'app-partners',
  templateUrl: './partners.component.html',
  styleUrls: ['./partners.component.css']
})
export class PartnersComponent {

  public images = [
    {
      url: "partners/marla_logo.webp",
      href: 'https://www.marla.blue/',
      alt: 'Marla Blue Logo',
      title: 'Click to visit Marla Blue',
      size: { height: 60, width: 273}
    },       
    {
      url: "partners/bsac-logo.webp",
      href: 'https://www.bsac.com/',
      alt: 'British Sub Aqua Club Logo',
      title: 'Click to visit BSAC',      
      size: { height: 100, width: 147}
    },   
    {
      url: "partners/christaylorphoto-small.webp",
      href: 'https://www.christaylorphoto.co.uk',
      alt: 'Chris Taylor Photo Logo',
      title: 'Click to visit Chris Taylor Photo',
      size: { height: 100, width: 100}
    },
    {
      url: "partners/rebecca-douglas-small.webp",      
      href: 'https://rebeccadouglas.co.uk/',
      alt: 'Rebecca Douglas 2025 Logo',
      title: 'Click to visit Rebecca Douglas Photography',
      size: { height: 100, width: 274}
    },
    {
      url: "partners/wild-running-jacket-cover-small.webp",
      href: 'https://jenandsimbenson.co.uk/',
      alt: 'Wild Running by Sim and Jen Benson',
      title: 'Click to visit Wild Running by Sim and Jen Benson',
      size: { height: 100, width: 82}
    },
    {
      url: "partners/wild-things-publishing-small.webp",
      href: 'https://wildthingspublishing.com',
      alt: 'Wild Things Publishing Logo',
      title: 'Click to visit Wild Things Publishing',
      size: { height: 100, width: 100} 
    },
    {
      url: "partners/jethro-haynes-small.png",
      href: 'https://www.jethrophoto.com/',
      alt: 'Jethro Haynes Photography Logo',
      title: 'Click to visit Jethro Haynes Photography',
      size: { height: 100, width: 100}
    },
    {
      url: "partners/St Martins Watersports Logo Navy-small.webp",
      href: 'https://www.stmartinswatersports.co.uk/',
      alt: 'St Martin\'s Watersports Logo',
      title: 'Click to visit St Martin\'s Watersports',
      size: { height: 89, width: 196}
    },
    {
      url: "partners/snorkelwild-small.webp",
      href: 'https://www.snorkelwild.com/',
      alt: 'Snorkel Wild Logo',
      title: 'Click to visit Snorkel Wild',
      size: { height: 100, width: 100}
    },
    {
      url: "partners/aquarium-logo-small.jpg",
      href: 'https://www.macduff-aquarium.org.uk/',
      alt: 'Macduff Marine Aquarium Logo',
      title: 'Click to visit Macduff Marine Aquarium',
      size: { height: 100, width: 161}
    },  
    {
      url: "partners/logo-seabird-centre-small.png",
      href: 'https://www.seabird.org/',
      alt: 'Scottish Seabird Centre Logo',
      title: 'Click to visit Scottish Seabird Centre',
      size: { height: 68, width: 111} 
    },
    {
      url: "partners/swt_logo-small.webp",
      href: 'https://snorkel.scottishwildlifetrust.org.uk/',
      alt: 'Scottish Wildlife Trust Logo', 
      title: 'Click to visit Scottish Wildlife Trust\'s dedicated snorkelling page',
      size: { height: 100, width: 256}
    },    
    {
      url: "partners/saltwater-life-small.webp",
      href: 'https://saltwaterlife.co.uk/',
      alt: 'Saltwater Life Logo', 
      title: 'Click to visit Saltwater Life',
      size: { height: 100, width: 101}
    },
  ]

  constructor(
  ) {
    this.images = this.images
      .map( value => ( { value, sort: Math.random() } ))
      .sort( (a, b) => a.sort - b.sort)
      .map(({ value }) => value)
  }
}
