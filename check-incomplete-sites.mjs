import mongoose from 'mongoose';
import FeatureModel from './schema/feature.js';

await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/snorkelology');

const sites = await FeatureModel.find(
  {
    showOnMap: { $in: ['Production', 'Development'] },
    'properties.featureType': 'Snorkelling Site'
  },
  { properties: 1 }
).lean();

function getCountrySlug(region) {
  if (!region) return null;
  const regionLower = String(region).toLowerCase();
  if (regionLower.includes('scotland')) return 'scotland';
  if (regionLower.includes('wales')) return 'wales';
  return 'england';
}

function getCountySlug(location) {
  if (!location) return null;
  const county = location.county || location.district || location.adminLevel3;
  if (!county) return null;
  return String(county).toLowerCase().replace(/\s+/g, '-').replace(/'/g, '');
}

const incomplete = sites.filter(site => {
  const loc = site.properties?.location || {};
  const county = getCountySlug(loc);
  return !county;
});

const validCountries = new Set(['england', 'scotland', 'wales']);
const invalidCountry = sites.filter(site => {
  const loc = site.properties?.location || {};
  const country = getCountrySlug(loc.region);
  return !validCountries.has(country);
});

console.log('=== Sites with missing county/district data ===');
incomplete.forEach(site => {
  const loc = site.properties?.location || {};
  console.log(`  ${site.properties.name} [region: ${loc.region || 'MISSING'}]`);
});
console.log(`\nMissing county: ${incomplete.length}\n`);

console.log('=== Sites with invalid country assignment ===');
invalidCountry.forEach(site => {
  const loc = site.properties?.location || {};
  const country = getCountrySlug(loc.region);
  console.log(`  ${site.properties.name} => ${country} (region: ${loc.region || 'MISSING'})`);
});
console.log(`\nInvalid country: ${invalidCountry.length}\n`);

const valid = sites.length - incomplete.length - invalidCountry.length;
console.log(`✓ Valid sites: ${valid} out of ${sites.length}`);

await mongoose.disconnect();
