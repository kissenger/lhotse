import { ImageCollection } from './types';

export const imageCollection: ImageCollection = {

// ***********
// Static Background
// ***********

  "scorpionfish": {
    type: 'parallax',
    url: "./assets/photos/parallax/scorpionfish-photographed-while-snorkelling-in-cornwall",
    ext: "webp",
    alt: "Photo of a Scorpionfish taking while snorkelling in Cornwall, Britain",
    orientation: {
      portrait: {height: 740, width: 400},
      landscape: {height: 1333, width: 2000}
    }
  },
  "cuddlingcrabs": {
    type: 'parallax',
    url: "./assets/photos/parallax/cuddling-crabs-snorkelling-scotland-britain",
    ext: "webp",
    alt: "Photo of two crabs having a cuddle underwater, taken in Scotland",
    orientation: {
      portrait: {height: 740, width: 400},
      landscape: {height: 1333, width: 2000}
    }
  },
  "sittingchild": {
    type: 'parallax',
    url: "./assets/photos/parallax/child-in-snorkelling-gear-scotland",
    ext: "webp",
    alt: "Photo of child sitting on a rock in snorkelling gear, looking out to sea",
    orientation: {
      portrait: {height: 740, width: 400},
      landscape: {height: 1333, width: 2000}
    }
  },
  "anemone": {
    type: 'parallax',
    url: "./assets/photos/parallax/dahlia-anemone-snorkelling-dorset-britain",
    ext: "webp",
    alt: "Photo of a Snakelocks Anemone taken while snorkelling in Dorset, Britain",
    orientation: {
      portrait: {height: 740, width: 400},
      landscape: {height: 1333, width: 2000}
    }
  },
  
// ***********
// Socials
// ***********

  "youtube": {
    type: 'social',
    url: "./assets/socials/youtube",
    ext: "webp",
    href: "https://www.youtube.com/channel/UCahtVWtV4eBCqFPVSfgdpbg",
    alt: "Click to see our YouTube channel",
    size: {
      small: { height: 40, width: 40}
    }
  },
  "instagram": {
    type: 'social',
    url: "./assets/socials/instagram",
    ext: "webp",
    href: "https://www.instagram.com/snorkelology/",
    alt: "Click to see our instagram feed",
    size: {
      small: { height: 40, width: 40}
    }
  },
  "email": {
    type: 'social',
    url: "./assets/socials/email",
    ext: "webp",
    href: "mailto:snorkelology@gmail.com",
    alt: "Click to send us an email",
    size: {
      small: { height: 40, width: 40}
    }
  },

// ***********
// Partners
// ***********

  "christaylor": {
    type: 'partner',
    url: "./assets/partners/christaylorphoto",
    ext: 'webp',
    href: 'https://www.christaylorphoto.co.uk',
    alt: 'Chris Taylor Photo Logo',
    size: {
      small: { height: 100, width: 100}
    }
  },
  "alphamarine": {
    type: 'partner',
    url: "./assets/partners/alphamarine",
    ext: 'webp',
    href: 'https://www.alphamarinephoto.com',
    alt: 'Alphamarine Logo',
    size: {
      small: { height: 100, width: 133}
    }
  },
  "wildlifetrusts": {
    type: 'partner',
    url: "./assets/partners/wildlifetrusts",
    ext: 'webp',
    href: 'https://www.wildlifetrusts.org',
    alt: 'Wildlife Trusts Logo',
    size: {
      small: { height: 101, width: 250}
    }
  },
  "wildrunning": {
    type: 'partner',
    url: "./assets/partners/wild-running-jacket-cover",
    ext: 'webp',
    href: 'https://jenandsimbenson.co.uk/',
    alt: 'Wild Running by Sim and Jen Benson',
    size: {
      small: { height: 100, width: 82}
    }
  },
  "wildthings": {
    type: 'partner',
    url: "./assets/partners/wild-things-publishing",
    ext: 'webp',
    href: 'https://wildthingspublishing.com',
    alt: 'Wild Things Publishing Logo', 
    size: {
      small: { height: 104, width: 100}
    }
  },
  "jethro": {
    type: 'partner',
    url: "./assets/partners/jethro-haynes",
    ext: 'png',
    href: 'https://www.jethrophoto.com/',
    alt: 'Jethro Haynes Photography',
    size: {
      small: { height: 104, width: 100}
    }
  },
  "stmartins": {
    type: 'partner',
    url: "./assets/partners/St Martins Watersports Logo Navy",
    ext: 'webp',
    href: 'https://www.stmartinswatersports.co.uk/',
    alt: 'St Martin\'s Watersports',
    size: {
      small: { height: 89, width: 196}
    }
  },
  "snorkelwild": {
    type: 'partner',
    url: "./assets/partners/snorkelwild",
    ext: 'webp',
    href: 'https://www.snorkelwild.com/',
    alt: 'Snorkel Wild Logo', 
    size: {
      small: { height: 100, width: 100}
    }
  },
  "macduff": {
    type: 'partner',
    url: "./assets/partners/aquarium-logo",
    ext: 'jpg',
    href: 'https://www.macduff-aquarium.org.uk/',
    alt: 'Macduff Marine Aquarium Logo', 
    size: {
      small: { height: 100, width: 100}
    }
  },  
  "seabird": {
    type: 'partner',
    url: "./assets/partners/logo-seabird-centre",
    ext: 'png',
    href: 'https://www.seabird.org/',
    alt: 'Scottish Seabird Centre Logo', 
    size: {
      small: { height: 100, width: 100}
    }
  },
  "swt": {
    type: 'partner',
    url: "./assets/partners/swt_logo",
    ext: 'webp',
    href: 'https://scottishwildlifetrust.org.uk/',
    alt: 'Scottish Wildlife Trust Logo', 
    size: {
      small: { height: 100, width: 256}
    }
  },

}

