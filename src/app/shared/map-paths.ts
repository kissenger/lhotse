export const MAP_COUNTRY_DISPLAY_NAMES: Record<string, string> = {
  england: 'England',
  scotland: 'Scotland',
  wales: 'Wales',
  britain: 'Britain',
  uk: 'the UK',
};

export const MAP_COUNTRY_REGION_MAP: Record<string, string | null> = {
  england: 'england',
  scotland: 'scotland',
  wales: 'wales',
  britain: null,
  uk: null,
};

export const MAP_COUNTY_ALT_NAMES: Record<string, string[]> = {
  'isles-of-scilly': ['Scillies', 'Scilly Isles'],
  cornwall: ['Scillies', 'Scilly Isles'],
  highland: ['Scottish Highlands'],
  highlands: ['Scottish Highlands'],
  'na-h-eileanan-siar': ['Outer Hebrides', 'Western Isles'],
  'outer-hebrides': ['Outer Hebrides', 'Western Isles'],
  'western-isles': ['Outer Hebrides', 'Western Isles'],
  'east-riding-of-yorkshire': ['East Yorkshire'],
  'east-yorkshire': ['East Yorkshire'],
  'isle-of-anglesey': ['Anglesey'],
  anglesey: ['Anglesey'],
  'orkney-islands': ['Orkney'],
  orkney: ['Orkney'],
};

export const MAP_COUNTY_DISPLAY_ALIASES: Record<string, string> = {
  cornwall: 'Cornwall & the Isles of Scilly',
  highlands: 'The Highlands',
  orkney: 'Orkney Islands',
  anglesey: 'Isle of Anglesey',
  'outer-hebrides': 'Outer Hebrides',
  'western-isles': 'Outer Hebrides',
  'east-yorkshire': 'East Riding of Yorkshire',
  'east-riding': 'East Riding of Yorkshire',
  'argyll-and-bute': 'Argyll and Bute',
  'brighton-and-hove': 'Brighton and Hove',
  'east-riding-of-yorkshire': 'East Riding of Yorkshire',
  'isle-of-anglesey': 'Isle of Anglesey',
  'isle-of-wight': 'Isle of Wight',
  'na-h-eileanan-siar': 'Na h-Eileanan Siar',
  'redcar-and-cleveland': 'Redcar and Cleveland',
};

const MAP_COUNTY_ALIAS_GROUPS: Record<string, string[]> = {
  cornwall: ['isles-of-scilly'],
  highlands: ['highland'],
  orkney: ['orkney-islands'],
  anglesey: ['isle-of-anglesey'],
  'outer-hebrides': ['na-h-eileanan-siar'],
  'western-isles': ['na-h-eileanan-siar'],
  'east-yorkshire': ['east-riding-of-yorkshire'],
  'east-riding': ['east-riding-of-yorkshire'],
};

function decodeSegment(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export function slugifyMapSegment(value: string | null | undefined): string {
  if (!value) {
    return '';
  }

  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[’']/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
}

export function normaliseCountrySegment(value: string | null | undefined): string | null {
  const slug = slugifyMapSegment(decodeSegment(value));
  if (slug === 'uk') {
    return 'britain';
  }
  return slug && Object.prototype.hasOwnProperty.call(MAP_COUNTRY_REGION_MAP, slug) ? slug : null;
}

export function normaliseCountySegment(value: string | null | undefined): string | null {
  const slug = slugifyMapSegment(decodeSegment(value));
  return slug || null;
}

export function normaliseSiteSegment(value: string | null | undefined): string | null {
  const slug = slugifyMapSegment(decodeSegment(value));
  return slug || null;
}

export function getCountrySlugFromRegion(region: string | null | undefined): string {
  const slug = slugifyMapSegment(region);
  return Object.prototype.hasOwnProperty.call(MAP_COUNTRY_REGION_MAP, slug) ? slug : 'britain';
}

export function getCountySlugFromLocation(location: any): string | null {
  const raw = [location?.county, location?.district, location?.adminLevel3]
    .find((value) => typeof value === 'string' && value.trim() !== '');

  return typeof raw === 'string' ? slugifyMapSegment(raw) : null;
}

export function getCountyMatchSlugs(countySlug: string): Set<string> {
  const matches = new Set<string>([countySlug]);
  const directAliases = MAP_COUNTY_ALIAS_GROUPS[countySlug] ?? [];
  for (const alias of directAliases) {
    matches.add(alias);
  }

  for (const [canonicalSlug, aliases] of Object.entries(MAP_COUNTY_ALIAS_GROUPS)) {
    if (aliases.includes(countySlug)) {
      matches.add(canonicalSlug);
      for (const alias of aliases) {
        matches.add(alias);
      }
    }
  }

  return matches;
}

export function getCountyDisplayName(countySlug: string): string {
  return MAP_COUNTY_DISPLAY_ALIASES[countySlug] ?? toTitleCase(countySlug.replace(/-/g, ' '));
}

export function getCountyAlsoKnownAs(countySlug: string): string[] | undefined {
  return MAP_COUNTY_ALT_NAMES[countySlug];
}

export function toTitleCase(value: string): string {
  return value.replace(/\b\w/g, (char) => char.toUpperCase());
}

export function buildMapPath(parts: { country?: string | null; county?: string | null; siteName?: string | null; siteSlug?: string | null }): string {
  const country = normaliseCountrySegment(parts.country);
  const county = normaliseCountySegment(parts.county);
  const siteSlug = parts.siteSlug ? normaliseSiteSegment(parts.siteSlug) : normaliseSiteSegment(parts.siteName);

  const segments = ['/map'];
  if (country) {
    segments.push(encodeURIComponent(country));
  }
  if (county) {
    segments.push(encodeURIComponent(county));
  }
  if (siteSlug) {
    segments.push(encodeURIComponent(siteSlug));
  }

  return segments.join('/');
}

export function buildMapPathForFeature(featureOrProperties: any): string {
  const properties = featureOrProperties?.properties ?? featureOrProperties;
  const location = properties?.location ?? {};
  return buildMapPath({
    country: getCountrySlugFromRegion(location.region),
    county: getCountySlugFromLocation(location),
    siteName: typeof properties?.name === 'string' ? properties.name : null,
  });
}