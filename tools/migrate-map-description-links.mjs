import mongoose from 'mongoose';
import 'dotenv/config';

const MAP_COUNTRY_SLUGS = new Set(['england', 'scotland', 'wales', 'britain', 'uk']);

const MAP_COUNTY_ALIAS_GROUPS = {
  cornwall: ['isles-of-scilly'],
  ayrshire: ['north-ayrshire', 'south-ayrshire'],
  aberdeenshire: ['moray', 'aberdeenshire-and-moray'],
  highlands: ['highland'],
  orkney: ['orkney-islands'],
  anglesey: ['isle-of-anglesey'],
  'outer-hebrides': ['na-h-eileanan-siar'],
  'western-isles': ['na-h-eileanan-siar'],
  'east-yorkshire': ['east-riding-of-yorkshire'],
  'east-riding': ['east-riding-of-yorkshire'],
};

const MAP_COUNTY_URL_SLUGS = {
  highlands: 'the-highlands',
};

const COUNTY_COUNTRY_FALLBACK = {
  'brighton-and-hove': 'england',
};

function parseArgs(argv) {
  return {
    apply: argv.includes('--apply'),
    help: argv.includes('--help') || argv.includes('-h'),
  };
}

function printHelp() {
  console.log(`Usage: node ./tools/migrate-map-description-links.mjs [--apply]\n\nCanonicalizes internal map links inside county/country description text.\n\nOptions:\n  --apply     Write changes. Without this flag, runs in dry-run mode.\n  --help,-h   Show help.\n\nEnvironment:\n  MONGO_URI   Required MongoDB connection string.`);
}

function slugify(value) {
  if (!value) return '';
  return String(value)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[’']/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
}

function normaliseCountrySegment(value) {
  const slug = slugify(value);
  if (slug === 'uk') return 'britain';
  return MAP_COUNTRY_SLUGS.has(slug) ? slug : null;
}

function normaliseCountySlug(slug) {
  if (!slug) return null;
  for (const [canonical, urlSlug] of Object.entries(MAP_COUNTY_URL_SLUGS)) {
    if (slug === urlSlug) return canonical;
  }
  for (const [canonical, aliases] of Object.entries(MAP_COUNTY_ALIAS_GROUPS)) {
    if (aliases.includes(slug)) return canonical;
  }
  return slug;
}

function normaliseCountySegment(value) {
  const slug = slugify(value);
  if (!slug) return null;
  return normaliseCountySlug(slug);
}

function normaliseSiteSegment(value) {
  const slug = slugify(value);
  if (!slug) return null;
  return normaliseCountySlug(slug);
}

function getCountrySlugFromRegion(region) {
  const slug = slugify(region);
  return MAP_COUNTRY_SLUGS.has(slug) ? (slug === 'uk' ? 'britain' : slug) : 'britain';
}

function getCountySlugFromLocation(location) {
  const raw = [location?.county, location?.district, location?.adminLevel3]
    .find((value) => typeof value === 'string' && value.trim() !== '');
  return typeof raw === 'string' ? normaliseCountySlug(slugify(raw)) : null;
}

function buildMapPath(parts) {
  const country = normaliseCountrySegment(parts.country);
  const county = normaliseCountySegment(parts.county);
  const siteSlug = parts.siteSlug ? normaliseSiteSegment(parts.siteSlug) : normaliseSiteSegment(parts.siteName);

  const segments = ['/map'];
  if (country) segments.push(encodeURIComponent(country));
  if (county) {
    const countyUrlSlug = MAP_COUNTY_URL_SLUGS[county] ?? county;
    segments.push(encodeURIComponent(countyUrlSlug));
  }
  if (siteSlug) segments.push(encodeURIComponent(siteSlug));

  return segments.join('/');
}

function canonicalizeMapHrefForDescription(href, defaultCountry) {
  if (!href) return href;

  const trimmed = String(href).trim();
  const absoluteMatch = trimmed.match(/^https?:\/\/snorkelology\.co\.uk(\/map\/[^\s?#"']*(?:\?[^\s#"']*)?)/i);
  const relativeHref = absoluteMatch ? absoluteMatch[1] : trimmed;

  if (!relativeHref.startsWith('/map/')) return href;

  const [pathname, query = ''] = relativeHref.split('?');
  const querySuffix = query ? `?${query}` : '';
  const segments = pathname.split('/').filter(Boolean);

  if (segments[0] !== 'map' || segments.length <= 1) return href;

  let canonicalPath = relativeHref;

  if (segments.length === 2) {
    const country = normaliseCountrySegment(segments[1]);
    if (country) {
      canonicalPath = buildMapPath({ country });
    } else {
      const county = normaliseCountySegment(segments[1]);
      if (county && defaultCountry) {
        canonicalPath = buildMapPath({ country: defaultCountry, county });
      }
    }
  } else if (segments.length === 3) {
    const country = normaliseCountrySegment(segments[1]);
    const county = normaliseCountySegment(segments[2]);
    if (country && county) {
      canonicalPath = buildMapPath({ country, county });
    } else {
      const inferredCounty = normaliseCountySegment(segments[1]);
      const siteSlug = normaliseSiteSegment(segments[2]);
      if (inferredCounty && siteSlug && defaultCountry) {
        canonicalPath = buildMapPath({ country: defaultCountry, county: inferredCounty, siteSlug });
      }
    }
  } else {
    const country = normaliseCountrySegment(segments[1]);
    const county = normaliseCountySegment(segments[2]);
    const siteSlug = normaliseSiteSegment(segments[3]);
    if (country && county && siteSlug) {
      canonicalPath = buildMapPath({ country, county, siteSlug });
    }
  }

  if (canonicalPath === relativeHref) return href;

  if (absoluteMatch) return `https://snorkelology.co.uk${canonicalPath}${querySuffix}`;
  return `${canonicalPath}${querySuffix}`;
}

function canonicalizeDescriptionLinks(description, defaultCountry) {
  if (!description) return '';

  let normalized = String(description).replace(/\[link:([^,\]]+),([^\]]+)\]/gi, (_m, text, link) => {
    const canonicalLink = canonicalizeMapHrefForDescription(link, defaultCountry);
    return `[link:${text},${canonicalLink}]`;
  });

  normalized = normalized.replace(/href=(['"])([^'"]+)\1/gi, (_m, quote, link) => {
    const canonicalHref = canonicalizeMapHrefForDescription(link, defaultCountry);
    return `href=${quote}${canonicalHref}${quote}`;
  });

  return normalized;
}

async function loadCountyCountryMap() {
  const sites = await mongoose.connection.collection('sites').find(
    { showOnMap: 'Production', 'properties.featureType': 'Snorkelling Site' },
    { projection: { 'properties.location': 1 } }
  ).toArray();

  const countyToCountry = new Map();
  for (const site of sites) {
    const location = site?.properties?.location ?? {};
    const countySlug = getCountySlugFromLocation(location);
    if (!countySlug || countyToCountry.has(countySlug)) continue;
    countyToCountry.set(countySlug, getCountrySlugFromRegion(location.region));
  }

  for (const [countySlug, countrySlug] of Object.entries(COUNTY_COUNTRY_FALLBACK)) {
    if (!countyToCountry.has(countySlug)) {
      countyToCountry.set(countySlug, countrySlug);
    }
  }

  return countyToCountry;
}

async function migrateCountyDescriptions(apply, countyToCountry) {
  const collection = mongoose.connection.collection('countydescriptions');
  const docs = await collection.find({}, { projection: { countySlug: 1, description: 1 } }).toArray();

  let changed = 0;
  const bulkOps = [];

  for (const doc of docs) {
    const countySlug = normaliseCountySegment(doc.countySlug) ?? doc.countySlug;
    const defaultCountry = countyToCountry.get(countySlug) ?? null;
    const description = typeof doc.description === 'string' ? doc.description : '';
    const normalized = canonicalizeDescriptionLinks(description, defaultCountry);
    if (normalized !== description) {
      changed += 1;
      bulkOps.push({
        updateOne: {
          filter: { _id: doc._id },
          update: { $set: { description: normalized } },
        },
      });
    }
  }

  console.log(`County descriptions: ${docs.length} checked, ${changed} to update.`);

  if (apply && bulkOps.length) {
    const result = await collection.bulkWrite(bulkOps, { ordered: false });
    console.log(`County descriptions modified: ${result.modifiedCount}`);
  }

  return changed;
}

async function migrateCountryDescriptions(apply) {
  const collection = mongoose.connection.collection('countrydescriptions');
  const docs = await collection.find({}, { projection: { countrySlug: 1, description: 1 } }).toArray();

  let changed = 0;
  const bulkOps = [];

  for (const doc of docs) {
    const countrySlug = normaliseCountrySegment(doc.countrySlug);
    const description = typeof doc.description === 'string' ? doc.description : '';
    const normalized = canonicalizeDescriptionLinks(description, countrySlug);
    if (normalized !== description) {
      changed += 1;
      bulkOps.push({
        updateOne: {
          filter: { _id: doc._id },
          update: { $set: { description: normalized } },
        },
      });
    }
  }

  console.log(`Country descriptions: ${docs.length} checked, ${changed} to update.`);

  if (apply && bulkOps.length) {
    const result = await collection.bulkWrite(bulkOps, { ordered: false });
    console.log(`Country descriptions modified: ${result.modifiedCount}`);
  }

  return changed;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    printHelp();
    return;
  }

  const mongoUri = process.env['MONGO_URI'];
  if (!mongoUri) {
    throw new Error('MONGO_URI is not set in environment.');
  }

  await mongoose.connect(mongoUri);

  try {
    const countyToCountry = await loadCountyCountryMap();
    const countyChanged = await migrateCountyDescriptions(options.apply, countyToCountry);
    const countryChanged = await migrateCountryDescriptions(options.apply);

    if (!options.apply) {
      console.log(`Dry run complete. ${countyChanged + countryChanged} document(s) would be updated.`);
      console.log('Re-run with --apply to write changes.');
      return;
    }

    console.log(`Done. ${countyChanged + countryChanged} document(s) updated.`);
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((error) => {
  console.error(`Migration failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
