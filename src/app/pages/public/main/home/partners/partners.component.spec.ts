import { TestBed } from '@angular/core/testing';
import { PartnersComponent } from './partners.component';

describe('PartnersComponent', () => {
  let comp: PartnersComponent;
  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [PartnersComponent] }).compileComponents();
    const f = TestBed.createComponent(PartnersComponent);
    comp = f.componentInstance;
  });

  it('creates partners component', () => {
    expect(comp).toBeTruthy();
  });

  it('keeps partner image order stable', () => {
    expect(comp.partners.map((partner) => partner.url)).toEqual([
      'partners/ocean-studio-logo.avif',
      'partners/marla_logo.webp',
      'partners/bsac-logo.webp',
      'partners/christaylorphoto-small.webp',
      'partners/rebecca-douglas-small.webp',
      'partners/wild-running-jacket-cover-small.webp',
      'partners/wild-things-publishing-small.webp',
      'partners/jethro-haynes-small.png',
      'partners/St Martins Watersports Logo Navy-small.webp',
      'partners/snorkelwild-small.webp',
      'partners/aquarium-logo-small.jpg',
      'partners/logo-seabird-centre-small.png',
      'partners/swt_logo-small.webp',
      'partners/saltwater-life-small.webp',
    ]);
  });
});
