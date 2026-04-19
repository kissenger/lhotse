import express from 'express';
import FeatureModel from '../schema/feature';
import { OrganisationModel } from '../schema/organisations';
import { verifyToken } from './server-auth';
import 'dotenv/config';

const AI_SCORE_THRESHOLD_DEFAULT = 70;

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
    $or: [
      { 'favourite.forcedPublish': true },
      {
        'favourite.suppressOnMap': { $ne: true },
        $or: [
          { 'favourite.isFavourite': true },
          {
            'generate.rank.rank_score': { $gte: threshold },
            'generate.rank.british_operations_pass': true,
            'generate.rank.active_presence_pass': true,
          },
        ],
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
      symbolSortOrder: id,
    }
  };
}

map.get('/api/sites/get-sites/*', async (req, res) => {

  let visibility = <string>Object.values(req.params)[0];

  try {
    const visibilityArr = visibility.split('/');
    const [sites, orgs] = await Promise.all([
      FeatureModel.find({ $or: [{ showOnMap: visibilityArr }], 'properties.featureType': 'Snorkelling Site' }),
      OrganisationModel.find(await buildOrgFilter()).lean(),
    ]);
    const siteFeatures = sites.map((s: any, i: number) => ({
      type: 'Feature',
      id: i,
      geometry: s.location,
      properties: s.properties,
    }));
    const orgFeatures = orgs
      .map((org: any, i: number) => orgToGeoJsonFeature(org, siteFeatures.length + i))
      .filter(Boolean);
    res.status(201).json({ type: 'FeatureCollection', features: [...siteFeatures, ...orgFeatures] });
  } catch (error: any) {
    console.error(error);
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

async function getPlacesForSeo() {
  const [sites, orgs] = await Promise.all([
    FeatureModel.find(
      { showOnMap: { $in: ['Production', 'Development'] } },
      { location: 1, properties: 1 }
    ).lean(),
    OrganisationModel.find(
      { ...(await buildOrgFilter()), _id: { $exists: true } },
      { discover: 1, favourite: 1 }
    ).lean(),
  ]);

  const siteSchemas = sites.map((site: any) => {
    const coords = site.location?.coordinates || [];
    const p = site.properties || {};
    const categories: string[] = p.categories || [];
    return {
      '@type': 'Place',
      name: p.name,
      description: p.featureType + ': ' + p.description,
      keywords: categories.length ? categories.join(', ') : undefined,
      address: toPostalAddress(p.location),
      geo: {
        '@type': 'GeoCoordinates',
        latitude: coords[1],
        longitude: coords[0]
      },
    };
  });

  const orgSchemas = orgs.map((org: any) => {
    const d = org.discover ?? {};
    const fav = org.favourite ?? {};
    const coords: number[] = d.location?.coordinates ?? [0, 0];
    const tags: string[] = Array.isArray(fav.tags) ? fav.tags : [];
    const category = (typeof fav.category === 'string' && fav.category.trim()) ? fav.category.trim() : '';
    const descriptionText = (typeof fav.description === 'string' && fav.description.trim()) ? fav.description.trim() : '';
    return {
      '@type': 'SportsActivityLocation',
      name: d.title,
      description: category ? category + ': ' + descriptionText : descriptionText,
      keywords: tags.length ? tags.join(', ') : undefined,
      address: toPostalAddress({ locality: d.city, postcode: d.postalCode, country: d.countryCode }),
      geo: {
        '@type': 'GeoCoordinates',
        latitude: coords[1],
        longitude: coords[0]
      },
      ...(d.website ? { url: d.website } : {}),
    };
  });

  return [...siteSchemas, ...orgSchemas];
}

async function getPlaceForSeo(siteName: string) {
  const site = await FeatureModel.findOne(
    { 'properties.name': siteName, showOnMap: { $in: ['Production', 'Development'] } },
    { location: 1, properties: 1 }
  ).lean();

  if (!site) {
    // Fall back to organisations collection
    const orgFilter = await buildOrgFilter();
    const org = await OrganisationModel.findOne(
      { ...orgFilter, 'discover.title': siteName },
      { discover: 1, favourite: 1 }
    ).lean();

    if (!org) return null;

    const d = (org as any).discover ?? {};
    const fav = (org as any).favourite ?? {};
    const coords: number[] = d.location?.coordinates ?? [0, 0];
    const tags: string[] = Array.isArray(fav.tags) ? fav.tags : [];
    const category = (typeof fav.category === 'string' && fav.category.trim()) ? fav.category.trim() : '';
    const descriptionText = (typeof fav.description === 'string' && fav.description.trim()) ? fav.description.trim() : '';
    const description = category
      ? `${category}${d.city ? ' in ' + d.city : ''}${descriptionText ? '. ' + descriptionText : ''}`
      : descriptionText;
    return {
      '@type': 'SportsActivityLocation' as const,
      name: d.title as string,
      description,
      keywords: tags.length ? tags.join(', ') : undefined,
      address: toPostalAddress({ locality: d.city, postcode: d.postalCode, country: d.countryCode }),
      geo: coords[0] != null && coords[1] != null ? {
        '@type': 'GeoCoordinates',
        latitude: coords[1],
        longitude: coords[0],
      } : undefined,
      image: d.imageUrl || undefined,
      ...(d.website ? { url: d.website } : {}),
      district: undefined as string | undefined,
    };
  }

  const s = site as any;
  const coords = s.location?.coordinates || [];
  const p = s.properties || {};
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

export { map, getPlacesForSeo, getPlaceForSeo };

map.get('/api/sites/get-provider-names/', async (_req, res) => {
  try {
    const orgs = await OrganisationModel.find(
      { ...(await buildOrgFilter()) },
      { 'discover.title': 1, updatedAt: 1 }
    ).lean();
    const result = (orgs as any[])
      .filter((o: any) => typeof o.discover?.title === 'string' && o.discover.title.trim() !== '')
      .map((o: any) => ({ name: o.discover.title as string, updatedAt: o.updatedAt }));
    res.status(200).json(result);
  } catch (error: any) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

map.get('/api/sites/get-districts/', async (_req, res) => {
  try {
    const sites = await FeatureModel.find(
      { showOnMap: { $in: ['Production', 'Development'] } },
      { 'properties.location.district': 1 }
    ).lean();
    const districts: string[] = [...new Set<string>(
      (sites as any[])
        .map((s: any) => s.properties?.location?.district)
        .filter((d: any): d is string => typeof d === 'string' && d.trim() !== '')
    )].sort();
    res.status(200).json(districts);
  } catch (error: any) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/* Admin CRUD endpoints */

map.get('/api/sites/get-all-sites-admin/', verifyToken, async (_req, res) => {
  try {
    const sites = await FeatureModel.find({}).sort({ 'properties.name': 'ascending' });
    res.status(200).json(sites);
  } catch (error: any) {
    console.error(error);
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
    console.error(error);
    res.status(500).send(error);
  }
});

map.get('/api/sites/delete-site/:_id', verifyToken, async (req, res) => {
  try {
    await FeatureModel.findByIdAndDelete(req.params._id);
    const result = await FeatureModel.find({}).sort({ 'properties.name': 'ascending' });
    res.status(201).json(result);
  } catch (error: any) {
    console.error(error);
    res.status(500).send(error);
  }
});