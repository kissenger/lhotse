import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const MONGO_URI = process.env.MONGO_URI;

// Copy normalization functions
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

function getCountySlugFromLocation(location) {
  const raw = [location?.county, location?.district, location?.adminLevel3]
    .find((value) => typeof value === 'string' && value.trim() !== '');
  return typeof raw === 'string' ? normaliseCountySlug(slugifyMapSegment(raw)) : null;
}

function getCountrySlugFromRegion(region) {
  const MAP_COUNTRY_REGION_MAP = {
    england: 'england',
    scotland: 'scotland',
    wales: 'wales',
    britain: null,
    uk: null,
  };
  
  const slug = slugifyMapSegment(region);
  return Object.prototype.hasOwnProperty.call(MAP_COUNTRY_REGION_MAP, slug) ? slug : 'britain';
}

function normaliseSiteSegment(value) {
  const slug = slugifyMapSegment(value);
  return normaliseCountySlug(slug || null);
}

function buildMapPath({ country, county, siteName }) {
  const parts = [country, county, siteName].filter(Boolean);
  return '/map/' + parts.map(part => {
    // This is simplified - the real function does more work
    return slugifyMapSegment(part);
  }).join('/');
}

async function debug() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('Connected to MongoDB');

    const db = mongoose.connection.db;
    
    // Build the same organisationFilter that the server uses
    const TRUTHY_FLAG_VALUES = [true, 1, 'true', 'yes', 'on'];
    const RANK_THRESHOLD = 50; // Example threshold
    
    const orgs = await db.collection('organisations').find({
      __type: { $exists: false },
      'favourite.suppressOnMap': { $nin: TRUTHY_FLAG_VALUES },
      $or: [
        { 'favourite.forcedPublish': { $in: TRUTHY_FLAG_VALUES } },
        { 'favourite.isFavourite': { $in: TRUTHY_FLAG_VALUES } },
        {
          'generate.rank.rank_score': { $gte: RANK_THRESHOLD },
          'generate.rank.british_operations_pass': true,
          'generate.rank.active_presence_pass': true,
        },
      ],
    }, { discover: 1, favourite: 1, reverse_geo: 1 }).toArray();

    console.log(`\nTotal organisations found: ${orgs.length}`);

    // Convert to SEO places like toOrganisationSeoPlace does
    const seoPlaces = orgs.map(org => {
      const d = org.discover ?? {};
      const fav = org.favourite ?? {};
      const gc = org.generate?.content ?? {};
      const reverseGeo = org.reverse_geo?.properties?.context ?? {};
      const district = reverseGeo.district?.name;
      const region = reverseGeo.region?.name;
      const countrySlug = getCountrySlugFromRegion(region);
      const countySlug = getCountySlugFromLocation({ district });
      
      // Use same name priority
      const firstNonEmpty = (...vals) => {
        for (const v of vals) {
          if (typeof v === 'string' && v.trim() !== '') return v.trim();
        }
        return '';
      };
      const orgName = firstNonEmpty(fav.name, gc.name, d.title);
      const siteSlug = normaliseSiteSegment(orgName);
      
      return {
        name: orgName,
        district,
        region,
        countrySlug,
        countySlug,
        siteSlug,
        path: buildMapPath({ country: countrySlug, county: countySlug, siteName: orgName }),
      };
    });

    // Filter for Cornwall
    const cornwallOrgs = seoPlaces.filter(org => org.countySlug === 'cornwall');
    
    console.log(`\nOrganisations in Cornwall: ${cornwallOrgs.length}`);
    cornwallOrgs.forEach(org => {
      console.log(`  - ${org.name} (slug: ${org.siteSlug})`);
    });

    // Specifically check Atlantic Adventures
    const atlantic = seoPlaces.find(org => org.name?.toLowerCase().includes('atlantic'));
    if (atlantic) {
      console.log(`\n✓ Atlantic Adventures found in cache building`);
      console.log(`  name: ${atlantic.name}`);
      console.log(`  countySlug: ${atlantic.countySlug}`);
      console.log(`  siteSlug: ${atlantic.siteSlug}`);
      console.log(`  countrySlug: ${atlantic.countrySlug}`);
      console.log(`  path: ${atlantic.path}`);
    } else {
      console.log(`\n✗ Atlantic Adventures NOT found in cache building`);
    }

    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

debug();
