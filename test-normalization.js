// Test the exact route normalization that happens in server.ts

function slugifyMapSegment(value) {
  if (!value) return '';
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/['']/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
}

function normaliseCountySlug(slug) {
  if (!slug) return null;
  return slug.replace(/\s+/g, '-').toLowerCase();
}

function normaliseSiteSegment(value) {
  const slug = slugifyMapSegment(value);
  return normaliseCountySlug(slug || null);
}

function normaliseCountySegment(value) {
  const slug = slugifyMapSegment(decodeSegment(value));
  return normaliseCountySlug(slug || null);
}

function normaliseCountrySegment(value) {
  const slug = slugifyMapSegment(decodeSegment(value));
  const MAP_COUNTRY_REGION_MAP = {
    england: 'england',
    scotland: 'scotland',
    wales: 'wales',
    britain: null,
    uk: null,
  };
  return Object.prototype.hasOwnProperty.call(MAP_COUNTRY_REGION_MAP, slug) ? slug : 'britain';
}

function decodeSegment(value) {
  if (!value) return null;
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

// Simulate the exact URL segments
const urlPath = '/map/england/cornwall/atlantic-adventures';
const segments = urlPath.split('/').filter(Boolean).slice(1); // ['map', 'england', 'cornwall', 'atlantic-adventures'] -> ['england', 'cornwall', 'atlantic-adventures']

console.log('URL segments:', segments);

const country = normaliseCountrySegment(segments[0]);
const county = normaliseCountySegment(segments[1]);
const siteSlug = normaliseSiteSegment(segments[2]);

console.log('\nNormalized:');
console.log(`  country: "${country}"`);
console.log(`  county: "${county}"`);
console.log(`  siteSlug: "${siteSlug}"`);

// Now check if these match what the cache has
const cacheItem = {
  countrySlug: 'england',
  countySlug: 'cornwall',
  siteSlug: 'atlantic-adventures'
};

console.log('\nCache item:');
console.log(`  countrySlug: "${cacheItem.countrySlug}"`);
console.log(`  countySlug: "${cacheItem.countySlug}"`);
console.log(`  siteSlug: "${cacheItem.siteSlug}"`);

console.log('\nMatch:');
console.log(`  country matches: ${country === cacheItem.countrySlug}`);
console.log(`  county matches: ${county === cacheItem.countySlug}`);
console.log(`  site matches: ${siteSlug === cacheItem.siteSlug}`);
