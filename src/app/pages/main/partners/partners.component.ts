import { Component } from '@angular/core';
import { NgOptimizedImage } from '@angular/common';

@Component({  
  standalone: true,
  imports: [NgOptimizedImage],
  selector: 'app-partners',
  templateUrl: './partners.component.html',
  styleUrls: ['./partners.component.css']
})
export class PartnersComponent {

  public images = [
    {
      url: "partners/christaylorphoto-small.webp",
      href: 'https://www.christaylorphoto.co.uk',
      alt: 'Chris Taylor Photo Logo',
      size: { height: 100, width: 100}
    },
    {
      url: "partners/alphamarine-small.webp",
      href: 'https://www.alphamarinephoto.com',
      alt: 'Alphamarine Logo',
      size: { height: 100, width: 133}
    },
    {
      url: "partners/wildlifetrusts-small.webp",
      href: 'https://www.wildlifetrusts.org',
      alt: 'Wildlife Trusts Logo',
      size: { height: 100, width: 250}
    },
    {
      url: "partners/wild-running-jacket-cover-small.webp",
      href: 'https://jenandsimbenson.co.uk/',
      alt: 'Wild Running by Sim and Jen Benson',
      size: { height: 100, width: 82}
    },
    {
      url: "partners/wild-things-publishing-small.webp",
      href: 'https://wildthingspublishing.com',
      alt: 'Wild Things Publishing Logo',
      size: { height: 100, width: 100} 
    },
    {
      url: "partners/jethro-haynes-small.png",
      href: 'https://www.jethrophoto.com/',
      alt: 'Jethro Haynes Photography',
      size: { height: 100, width: 100}
    },
    {
      url: "partners/St Martins Watersports Logo Navy-small.webp",
      href: 'https://www.stmartinswatersports.co.uk/',
      alt: 'St Martin\'s Watersports',
      size: { height: 89, width: 196}
    },
    {
      url: "partners/snorkelwild-small.webp",
      href: 'https://www.snorkelwild.com/',
      alt: 'Snorkel Wild Logo',
      size: { height: 100, width: 100}
    },
    {
      url: "partners/aquarium-logo-small.jpg",
      href: 'https://www.macduff-aquarium.org.uk/',
      alt: 'Macduff Marine Aquarium Logo',
      size: { height: 100, width: 161}
    },  
    {
      url: "partners/logo-seabird-centre-small.png",
      href: 'https://www.seabird.org/',
      alt: 'Scottish Seabird Centre Logo',
      size: { height: 68, width: 111} 
    },
    {
      url: "partners/swt_logo-small.webp",
      href: 'https://scottishwildlifetrust.org.uk/',
      alt: 'Scottish Wildlife Trust Logo', 
      size: { height: 100, width: 256}
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
