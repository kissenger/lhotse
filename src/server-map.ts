import express from 'express';
import FeatureModel from '../schema/feature';
import { OrganisationModel } from '../schema/organisations';
import CountyDescriptionModel from '../schema/county-description';
import CountryDescriptionModel from '../schema/country-description';
import { verifyToken } from './server-auth';
import { buildMapPath, getCountrySlugFromRegion, getCountySlugFromLocation, normaliseCountrySegment, normaliseCountySegment, normaliseSiteSegment, slugifyMapSegment } from './app/shared/map-paths';
import 'dotenv/config';

const AI_SCORE_THRESHOLD_DEFAULT = 70;
const TRUTHY_FLAG_VALUES: Array<string | number | boolean> = [true, 'true', 1, '1', 'yes', 'on'];

const map = express();

async function getOrgScoreThreshold(): Promise<number> {
  try {
    const doc = await (OrganisationModel as any).findOne({ __type: 'settings' }).lean();
    if (doc?.scoringThreshold != null) return Number(doc.scoringThreshold);
  } catch {}
  return AI_SCORE_THRESHOLD_DEFAULT;
}

async function buildOrgFilter(): Promise<Record<string, unknown>> {
  const threshold = await getOrgScoreThreshold();
  return {
    __type: { $exists: false },
    'favourite.suppressOnMap': { $nin: TRUTHY_FLAG_VALUES },
    $or: [
      { 'favourite.forcedPublish': { $in: TRUTHY_FLAG_VALUES } },
      { 'favourite.isFavourite': { $in: TRUTHY_FLAG_VALUES } },
      {
        'generate.rank.rank_score': { $gte: threshold },
        'generate.rank.british_operations_pass': true,
        'generate.rank.active_presence_pass': true,
      },
    ],
  };
}

function orgToGeoJsonFeature(org: any, id: number) {
  const d = org.discover ?? {};
  const sl = org.generate?.rank?.socialLinks ?? {};
  const fav = org.favourite ?? {};
  const favContacts = fav.contacts ?? fav.socialLinks ?? {};
  const gc = org.generate?.content ?? {};
  const rgCtx = org.reverse_geo?.properties?.context ?? {};
  const coords: number[] | undefined = d.location?.coordinates;
  if (!coords || coords.length < 2) return null;
  const [lng, lat] = coords;
  const firstNonEmpty = (...vals: unknown[]): string => {
    for (const v of vals) {
      if (typeof v === 'string' && v.trim() !== '') return v.trim();
    }
    return '';
  };
  const hasNonEmptyArray = (v: unknown): v is string[] => Array.isArray(v) && v.some(x => typeof x === 'string' && x.trim() !== '');
  const favouriteTags = hasNonEmptyArray(fav.tags) ? fav.tags : [];
  const generatedTags = hasNonEmptyArray(gc.tags) ? gc.tags : [];

  const website   = firstNonEmpty(favContacts.website, fav.website, sl.website, d.website);
  const facebook  = firstNonEmpty(favContacts.facebook, fav.facebook, sl.facebook);
  const instagram = firstNonEmpty(favContacts.instagram, fav.instagram, sl.instagram);
  const youtube   = firstNonEmpty(favContacts.youtube, fav.youtube, sl.youtube);
  const phone     = firstNonEmpty(favContacts.phone, fav.phone) || undefined;
  const email     = firstNonEmpty(favContacts.email, fav.email) || undefined;
  return {
    type: 'Feature',
    id,
    geometry: { type: 'Point', coordinates: [lng, lat] },
    properties: {
      featureType:  firstNonEmpty(fav.category, fav.categoryName, gc.category) || 'Snorkelling Organisation',
      name:         firstNonEmpty(fav.name, gc.name, d.title),
      description:  firstNonEmpty(fav.description, gc.description),
      categories:   favouriteTags.length ? favouriteTags : generatedTags,
      location: {
        locality:    firstNonEmpty(fav.localityOverride, rgCtx.place?.name, d.city),
        place:       rgCtx.place?.name,
        district:    rgCtx.district?.name,
        region:      rgCtx.region?.name,
        country:     rgCtx.country?.name,
        postcode:    rgCtx.postcode?.name,
        address:     d.address,
      },
      moreInfo: [
        website   ? { icon: 'website',   url: website,           text: 'Website'   } : null,
        facebook  ? { icon: 'facebook',  url: facebook,          text: 'Facebook'  } : null,
        instagram ? { icon: 'instagram', url: instagram,         text: 'Instagram' } : null,
        youtube   ? { icon: 'youtube',   url: youtube,           text: 'YouTube'   } : null,
        phone     ? { icon: 'phone',     url: `tel:${phone}`,    text: phone       } : null,
        email     ? { icon: 'email',     url: `mailto:${email}`, text: email       } : null,
      ].filter(Boolean),
      verified:      fav.verified ?? false,
      updatedAt: org.updatedAt,
      symbolSortOrder: id,
    }
  };
}

map.get('/api/sites/get-sites/*', async (req, res) => {

  let visibility = <string>Object.values(req.params)[0];

  try {
    const visibilityArr = visibility.split('/');
    const [sites, orgs] = await Promise.all([
      FeatureModel.find({
        showOnMap: { $in: visibilityArr },
      }),
      OrganisationModel.find(await buildOrgFilter()).lean(),
    ]);
    const siteFeatures = sites.map((s: any, i: number) => ({
      type: 'Feature',
      id: i,
      geometry: s.location,
      properties: {
        ...s.properties,
        updatedAt: s.updatedAt,
      },
    }));
    const orgFeatures = orgs
      .map((org: any, i: number) => orgToGeoJsonFeature(org, siteFeatures.length + i))
      .filter(Boolean);
    res.status(201).json({ type: 'FeatureCollection', features: [...siteFeatures, ...orgFeatures] });
  } catch (error: any) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

function toPostalAddress(location: any) {
  if (!location || typeof location !== 'object') {
    return undefined;
  }

  const address = {
    '@type': 'PostalAddress',
    addressLocality: location.locality || location.place,
    addressRegion: location.district,
    streetAddress: location.region,
    postalCode: location.postcode || location.postalCode,
    addressCountry: location.country || location.countryCode
  } as any;

  const hasAddressValue = Object.entries(address)
    .some(([key, value]) => key !== '@type' && !!value);

  return hasAddressValue ? address : undefined;
}

function extractProviderLinks(moreInfo: any[]): { url: string | undefined; sameAs: string[] | undefined } {
  const entries: any[] = Array.isArray(moreInfo) ? moreInfo : [];
  const urls = entries
    .map((m: any) => m?.url)
    .filter((u: any): u is string => typeof u === 'string' && u.trim() !== '');

  if (!urls.length) return { url: undefined, sameAs: undefined };

  const preferred = entries.find((m: any) => m?.preferred && m?.url);
  const primaryUrl: string = preferred?.url ?? urls[0];
  const rest = urls.filter(u => u !== primaryUrl);

  return { url: primaryUrl, sameAs: rest.length ? rest : undefined };
}

function toSiteSeoPlace(site: any) {
  const coords = site.location?.coordinates || [];
  const p = site.properties || {};
  const categories: string[] = p.categories || [];
  const location = p.location || {};
  const countrySlug = getCountrySlugFromRegion(location.region);
  const countySlug = getCountySlugFromLocation(location);
  const siteSlug = normaliseSiteSegment(p.name);

  return {
    '@type': 'Place',
    name: p.name,
    description: p.featureType + ': ' + p.description,
    keywords: categories.length ? categories.join(', ') : undefined,
    address: toPostalAddress(location),
    geo: {
      '@type': 'GeoCoordinates',
      latitude: coords[1],
      longitude: coords[0]
    },
    countrySlug,
    countySlug,
    siteSlug,
    path: buildMapPath({ country: countrySlug, county: countySlug, siteName: p.name }),
    district: location.district as string | undefined,
    image: p.imageUrl || undefined,
  };
}

function toOrganisationSeoPlace(org: any) {
  const d = org.discover ?? {};
  const fav = org.favourite ?? {};
  const coords: number[] = d.location?.coordinates ?? [0, 0];
  const tags: string[] = Array.isArray(fav.tags) ? fav.tags : [];
  const category = (typeof fav.category === 'string' && fav.category.trim()) ? fav.category.trim() : '';
  const descriptionText = (typeof fav.description === 'string' && fav.description.trim()) ? fav.description.trim() : '';
  const reverseGeo = org.reverse_geo?.properties?.context ?? {};
  const district = reverseGeo.district?.name as string | undefined;
  const region = reverseGeo.region?.name as string | undefined;
  const countrySlug = getCountrySlugFromRegion(region);
  const countySlug = getCountySlugFromLocation({ district });
  const siteSlug = normaliseSiteSegment(d.title);

  return {
    '@type': 'SportsActivityLocation',
    name: d.title,
    description: category ? `${category}${d.city ? ' in ' + d.city : ''}${descriptionText ? '. ' + descriptionText : ''}` : descriptionText,
    keywords: tags.length ? tags.join(', ') : undefined,
    address: toPostalAddress({ locality: d.city, postcode: d.postalCode, country: d.countryCode }),
    geo: {
      '@type': 'GeoCoordinates',
      latitude: coords[1],
      longitude: coords[0]
    },
    ...(d.website ? { url: d.website } : {}),
    countrySlug,
    countySlug,
    siteSlug,
    path: buildMapPath({ country: countrySlug, county: countySlug, siteName: d.title }),
    district,
    image: d.imageUrl || undefined,
  };
}

function stripRouteMeta(place: any) {
  const { countrySlug: _countrySlug, countySlug: _countySlug, siteSlug: _siteSlug, path: _path, ...schemaPlace } = place;
  return schemaPlace;
}

async function getPlacesForSeo() {
  const places = await getPlacesForSeoWithRouteMeta();
  return places.map((place: any) => stripRouteMeta(place));
}

async function getPlacesForSeoWithRouteMeta() {
  const [sites, orgs] = await Promise.all([
    FeatureModel.find(
      { showOnMap: { $in: ['Production', 'Development'] } },
      { location: 1, properties: 1 }
    ).lean(),
    OrganisationModel.find(
      { ...(await buildOrgFilter()), _id: { $exists: true } },
      { discover: 1, favourite: 1, reverse_geo: 1 }
    ).lean(),
  ]);

  const siteSchemas = sites.map((site: any) => toSiteSeoPlace(site));
  const orgSchemas = orgs.map((org: any) => toOrganisationSeoPlace(org));

  return [...siteSchemas, ...orgSchemas];
}

async function getPlaceForSeo(siteName: string) {
  const site = await FeatureModel.findOne(
    {
      'properties.name': siteName,
      showOnMap: { $in: ['Production', 'Development'] },
      'properties.featureType': 'Snorkelling Site'
    },
    { location: 1, properties: 1 }
  ).lean();

  if (!site) {
    return null;
  }

  const s = site as any;
  const basePlace = toSiteSeoPlace(s);
  const p = s.properties || {};
  const coords = s.location?.coordinates || [];
  const categories: string[] = p.categories || [];
  const loc = p.location || {};
  const localityParts = [loc.localityOverride || loc.locality || loc.place, loc.district].filter(Boolean);
  const localityStr = localityParts.join(', ');
  const descriptionParts: string[] = [];
  if (p.featureType) descriptionParts.push(p.featureType);
  if (localityStr) descriptionParts.push(`in ${localityStr}`);
  const baseDesc = descriptionParts.join(' ');
  const description = p.description
    ? `${baseDesc ? baseDesc + '. ' : ''}${p.description}`
    : baseDesc;
  const isSnorkellingSite = p.featureType === 'Snorkelling Site';
  const schemaType = isSnorkellingSite ? 'TouristAttraction' : 'SportsActivityLocation';
  const links = isSnorkellingSite ? { url: undefined, sameAs: undefined } : extractProviderLinks(p.moreInfo);

  return {
    ...basePlace,
    '@type': schemaType,
    name: p.name as string,
    description,
    keywords: categories.length ? categories.join(', ') : undefined,
    address: toPostalAddress(p.location),
    geo: coords[0] != null && coords[1] != null ? {
      '@type': 'GeoCoordinates',
      latitude: coords[1],
      longitude: coords[0]
    } : undefined,
    image: p.imageUrl || undefined,
    ...(links.url ? { url: links.url } : {}),
    ...(links.sameAs ? { sameAs: links.sameAs } : {}),
    district: loc.district as string | undefined,
  };
}

async function getPlaceForSeoByRoute(countrySlug: string | null, countySlug: string | null, siteSlug: string) {
  const [sites, orgs] = await Promise.all([
    FeatureModel.find(
      {
        showOnMap: { $in: ['Production', 'Development'] },
        'properties.featureType': 'Snorkelling Site'
      },
      { location: 1, properties: 1 }
    ).lean(),
    OrganisationModel.find(
      { ...(await buildOrgFilter()), _id: { $exists: true } },
      { discover: 1, favourite: 1, reverse_geo: 1 }
    ).lean(),
  ]);

  const places = [
    ...(sites as any[]).map((site: any) => toSiteSeoPlace(site)),
    ...(orgs as any[]).map((org: any) => toOrganisationSeoPlace(org)),
  ];

  const normalisedCountry = normaliseCountrySegment(countrySlug);
  const normalisedCounty = normaliseCountySegment(countySlug);
  const normalisedSite = normaliseSiteSegment(siteSlug);

  const exactMatch = places.find((place: any) => {
    if (place.siteSlug !== normalisedSite) {
      return false;
    }
    if (normalisedCounty && place.countySlug && place.countySlug !== normalisedCounty) {
      return false;
    }
    if (normalisedCountry && place.countrySlug !== normalisedCountry) {
      return false;
    }
    return true;
  });

  if (exactMatch) {
    return exactMatch;
  }

  return places.find((place: any) => place.siteSlug === normalisedSite) ?? null;
}

async function getCountrySlugForCounty(countySlug: string) {
  const [sites, orgs] = await Promise.all([
    FeatureModel.find(
      { showOnMap: { $in: ['Production', 'Development'] } },
      { 'properties.location': 1 }
    ).lean(),
    OrganisationModel.find(
      { ...(await buildOrgFilter()), _id: { $exists: true } },
      { reverse_geo: 1 }
    ).lean(),
  ]);

  const normalisedCounty = normaliseCountySegment(countySlug);
  for (const site of sites as any[]) {
    const location = site.properties?.location ?? {};
    if (getCountySlugFromLocation(location) === normalisedCounty) {
      return getCountrySlugFromRegion(location.region);
    }
    const districtSlug = slugifyMapSegment(location.district as string | undefined);
    const legacySlug = slugifyMapSegment(location.adminLevel3 as string | undefined);
    if (districtSlug === normalisedCounty || legacySlug === normalisedCounty) {
      return getCountrySlugFromRegion(location.region);
    }
  }

  for (const org of orgs as any[]) {
    const district = org.reverse_geo?.properties?.context?.district?.name as string | undefined;
    if (!district) continue;
    if (slugifyMapSegment(district) === normalisedCounty) {
      const region = org.reverse_geo?.properties?.context?.region?.name as string | undefined;
      return getCountrySlugFromRegion(region);
    }
  }

  return null;
}

export { map, getPlacesForSeo, getPlacesForSeoWithRouteMeta, getPlaceForSeo, getPlaceForSeoByRoute, getCountrySlugForCounty };

map.get('/api/sites/get-provider-names/', async (_req, res) => {
  try {
    const sites = await FeatureModel.find(
      {
        showOnMap: { $in: ['Production', 'Development'] },
        'properties.featureType': 'Snorkelling Site'
      },
      { 'properties.name': 1, 'properties.location': 1, updatedAt: 1 }
    ).lean();
    const result = (sites as any[])
      .filter((site: any) => typeof site.properties?.name === 'string' && site.properties.name.trim() !== '')
      .map((site: any) => ({
        name: site.properties.name as string,
        updatedAt: site.updatedAt,
        path: buildMapPath({
          country: getCountrySlugFromRegion(site.properties?.location?.region),
          county: getCountySlugFromLocation(site.properties?.location),
          siteName: site.properties.name as string,
        })
      }));
    res.status(200).json(result);
  } catch (error: any) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

map.get('/api/sites/get-districts/', async (_req, res) => {
  try {
    const sites = await FeatureModel.find(
      { showOnMap: { $in: ['Production', 'Development'] }, 'properties.featureType': 'Snorkelling Site' },
      { 'properties.location': 1 }
    ).lean();
    const districts = [...new Map(
      (sites as any[])
        .map((site: any) => {
          const location = site.properties?.location ?? {};
          const countySlug = getCountySlugFromLocation(location);
          if (!countySlug) {
            return null;
          }
          const path = buildMapPath({
            country: getCountrySlugFromRegion(location.region),
            county: countySlug,
          });
          return [path, { name: location.district ?? location.county ?? location.adminLevel3, path }];
        })
        .filter((entry: any): entry is [string, { name: string; path: string }] => !!entry)
    ).values()].sort((a, b) => a.path.localeCompare(b.path));
    res.status(200).json(districts);
  } catch (error: any) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

map.get('/api/sites/get-county-description/:countySlug', async (req, res) => {
  try {
    const countySlug = normaliseCountySegment(req.params.countySlug);
    if (!countySlug) {
      res.status(400).json({ error: 'invalid countySlug' });
      return;
    }

    const doc = await CountyDescriptionModel.findOne(
      { countySlug },
      { countyName: 1, countySlug: 1, description: 1 }
    ).lean();

    if (!doc) {
      res.status(200).json({ countySlug, description: '' });
      return;
    }

    res.status(200).json({
      countyName: (doc as any).countyName,
      countySlug: (doc as any).countySlug,
      description: typeof (doc as any).description === 'string' ? (doc as any).description : '',
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

/* Admin CRUD endpoints */

map.get('/api/sites/get-all-sites-admin/', verifyToken, async (_req, res) => {
  try {
    const sites = await FeatureModel.find({}).sort({ 'properties.name': 'ascending' });
    res.status(200).json(sites);
  } catch (error: any) {
    res.status(500).send(error);
  }
});

map.post('/api/sites/upsert-site/', verifyToken, async (req, res) => {
  try {
    if (req.body._id && req.body._id !== '') {
      await FeatureModel.findByIdAndUpdate(req.body._id, req.body);
    } else {
      delete req.body._id;
      const isSnorkel = req.body.properties?.featureType === 'Snorkelling Site';
      const bandQuery = isSnorkel
        ? { 'properties.featureType': 'Snorkelling Site' }
        : { 'properties.featureType': { $ne: 'Snorkelling Site' } };
      const maxDoc = await FeatureModel.findOne(bandQuery, { 'properties.symbolSortOrder': 1 })
        .sort({ 'properties.symbolSortOrder': -1 })
        .lean();
      const maxOrder = (maxDoc as any)?.properties?.symbolSortOrder ?? (isSnorkel ? 999 : 0);
      req.body.properties = req.body.properties ?? {};
      req.body.properties.symbolSortOrder = maxOrder + 1;
      await FeatureModel.create(req.body);
    }
    const result = await FeatureModel.find({}).sort({ 'properties.name': 'ascending' });
    res.status(201).json(result);
  } catch (error: any) {
    res.status(500).send(error);
  }
});

map.get('/api/sites/delete-site/:_id', verifyToken, async (req, res) => {
  try {
    await FeatureModel.findByIdAndDelete(req.params._id);
    const result = await FeatureModel.find({}).sort({ 'properties.name': 'ascending' });
    res.status(201).json(result);
  } catch (error: any) {
    res.status(500).send(error);
  }
});

map.get('/api/sites/get-counties-admin/', verifyToken, async (_req, res) => {
  try {
    const sites = await FeatureModel.find(
      { showOnMap: 'Production', 'properties.featureType': 'Snorkelling Site' },
      { 'properties.location': 1 }
    ).lean();

    const docs = await CountyDescriptionModel.find(
      {},
      { countyName: 1, countySlug: 1, description: 1 }
    ).lean();

    const docsBySlug = new Map<string, any>();
    for (const doc of docs as any[]) {
      if (typeof doc.countySlug === 'string' && doc.countySlug) {
        docsBySlug.set(doc.countySlug, doc);
      }
    }

    const mergedBySlug = new Map<string, { _id?: string; countyName: string; countySlug: string; description: string }>();

    for (const site of sites as any[]) {
      const location = site.properties?.location ?? {};
      const countyName = (location.district ?? location.county ?? location.adminLevel3 ?? '').trim();
      if (!countyName) continue;
      const countySlug = slugifyMapSegment(countyName);
      if (!countySlug) continue;
      const existing = docsBySlug.get(countySlug);
      mergedBySlug.set(countySlug, {
        _id: existing?._id?.toString(),
        countyName,
        countySlug,
        description: typeof existing?.description === 'string' ? existing.description : '',
      });
    }

    for (const doc of docs as any[]) {
      const countySlug = typeof doc.countySlug === 'string' ? doc.countySlug : '';
      if (!countySlug || mergedBySlug.has(countySlug)) continue;
      mergedBySlug.set(countySlug, {
        _id: doc._id?.toString(),
        countyName: doc.countyName,
        countySlug,
        description: typeof doc.description === 'string' ? doc.description : '',
      });
    }

    const result = [...mergedBySlug.values()].sort((a, b) => a.countyName.localeCompare(b.countyName));
    res.status(200).json(result);
  } catch (error: any) {
    res.status(500).send(error);
  }
});

map.post('/api/sites/upsert-county-description/', verifyToken, async (req, res) => {
  try {
    const countyName = String(req.body?.countyName ?? '').trim();
    const description = String(req.body?.description ?? '');
    if (!countyName) {
      res.status(400).json({ error: 'countyName is required' });
      return;
    }

    const countySlug = slugifyMapSegment(countyName);
    if (!countySlug) {
      res.status(400).json({ error: 'invalid countyName' });
      return;
    }

    const saved = await CountyDescriptionModel.findOneAndUpdate(
      { countySlug },
      { $set: { countyName, countySlug, description } },
      { upsert: true, new: true }
    ).lean();

    res.status(201).json(saved);
  } catch (error: any) {
    res.status(500).send(error);
  }
});

map.delete('/api/sites/delete-county-description/:_id', verifyToken, async (req, res) => {
  try {
    await CountyDescriptionModel.findByIdAndDelete(req.params._id);
    res.status(204).send();
  } catch (error: any) {
    res.status(500).send(error);
  }
});

map.get('/api/sites/get-country-description/:countrySlug', async (req, res) => {
  try {
    const countrySlug = normaliseCountrySegment(req.params.countrySlug);
    if (!countrySlug) {
      res.status(400).json({ error: 'invalid countrySlug' });
      return;
    }

    const doc = await CountryDescriptionModel.findOne(
      { countrySlug },
      { countryName: 1, countrySlug: 1, description: 1 }
    ).lean();

    if (!doc) {
      res.status(200).json({ countrySlug, description: '' });
      return;
    }

    res.status(200).json({
      countryName: (doc as any).countryName,
      countrySlug: (doc as any).countrySlug,
      description: typeof (doc as any).description === 'string' ? (doc as any).description : '',
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

map.get('/api/sites/get-countries-admin/', verifyToken, async (_req, res) => {
  try {
    const docs = await CountryDescriptionModel.find(
      {},
      { countryName: 1, countrySlug: 1, description: 1 }
    ).lean();

    const docsBySlug = new Map<string, any>();
    for (const doc of docs as any[]) {
      if (typeof (doc as any).countrySlug === 'string') {
        docsBySlug.set((doc as any).countrySlug, doc);
      }
    }

    // Merge static known countries with any DB records
    const KNOWN_COUNTRIES: Record<string, string> = { britain: 'Britain', england: 'England', scotland: 'Scotland', wales: 'Wales' };
    const mergedBySlug = new Map<string, { _id?: string; countryName: string; countrySlug: string; description: string }>();

    for (const [slug, displayName] of Object.entries(KNOWN_COUNTRIES)) {
      const existing = docsBySlug.get(slug);
      mergedBySlug.set(slug, {
        _id: existing?._id?.toString(),
        countryName: displayName,
        countrySlug: slug,
        description: typeof existing?.description === 'string' ? existing.description : '',
      });
    }

    // Also include any DB records not in the static list
    for (const doc of docs as any[]) {
      const slug = typeof (doc as any).countrySlug === 'string' ? (doc as any).countrySlug : '';
      if (!slug || mergedBySlug.has(slug)) continue;
      mergedBySlug.set(slug, {
        _id: (doc as any)._id?.toString(),
        countryName: (doc as any).countryName,
        countrySlug: slug,
        description: typeof (doc as any).description === 'string' ? (doc as any).description : '',
      });
    }

    const result = [...mergedBySlug.values()].sort((a, b) => a.countryName.localeCompare(b.countryName));
    res.status(200).json(result);
  } catch (error: any) {
    res.status(500).send(error);
  }
});

map.post('/api/sites/upsert-country-description/', verifyToken, async (req, res) => {
  try {
    const countryName = String(req.body?.countryName ?? '').trim();
    const description = String(req.body?.description ?? '');
    if (!countryName) {
      res.status(400).json({ error: 'countryName is required' });
      return;
    }

    const countrySlug = normaliseCountrySegment(countryName.toLowerCase().replace(/\s+/g, '-'));
    if (!countrySlug) {
      res.status(400).json({ error: 'invalid countryName' });
      return;
    }

    const saved = await CountryDescriptionModel.findOneAndUpdate(
      { countrySlug },
      { $set: { countryName, countrySlug, description } },
      { upsert: true, new: true }
    ).lean();

    res.status(201).json(saved);
  } catch (error: any) {
    res.status(500).send(error);
  }
});

map.delete('/api/sites/delete-country-description/:_id', verifyToken, async (req, res) => {
  try {
    await CountryDescriptionModel.findByIdAndDelete(req.params._id);
    res.status(204).send();
  } catch (error: any) {
    res.status(500).send(error);
  }
});