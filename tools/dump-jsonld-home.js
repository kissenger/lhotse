// Simple helper to print the JSON-LD that HomeComponent injects via SEOService
// Run with: node ./tools/dump-jsonld-home.js

const description = `Snorkelology is a website from the authors of Snorkelling Britain - 
    Explore our NEW snorkelling map of Britain or visit our micro store.`;

const orgSchema = {
  '@context': 'http://schema.org',
  '@type': 'Organization',
  name: 'Snorkelology',
  url: 'https://snorkelology.co.uk',
  logo: 'https://snorkelology.co.uk/banner/snround.webp',
  description,
  sameAs: [
    'https://instagram.com/snorkelology',
    'https://www.youtube.com/@snorkelology',
    'https://www.facebook.com/snorkelology',
  ],
};

console.log('\nJSON-LD for Home (Organization schema):');
console.log(JSON.stringify(orgSchema, null, 2));
