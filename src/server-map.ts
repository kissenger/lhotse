import express from 'express';
import FeatureModel from '../schema/feature';
import { verifyToken } from './server-auth';
import 'dotenv/config';

const map = express();

map.get('/api/sites/get-sites/*', async (req, res) => {

  let visibility = <string>Object.values(req.params)[0];
  
  try {
    const sites = await FeatureModel.find({$or: [{showOnMap: visibility.split('/')}]});
    res.status(201).json(geoJson(sites));
  } catch (error: any) {
    res.status(500).send(error);
  }
});

function geoJson(sites:any) {
  return {
    type: "FeatureCollection",
    features: sites.map((s:any,i:number)=>({
      type: "Feature",
      id: i,
      geometry: s.location,
      properties: s.properties
    }))
  }
}

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
  const sites = await FeatureModel.find(
    { showOnMap: { $in: ['Production', 'Development'] } },
    { location: 1, properties: 1 }
  ).lean();

  return sites.map((site: any) => {
    const coords = site.location?.coordinates || [];
    const p = site.properties || {};
    const categories: string[] = p.categories || [];
    const isProvider = p.featureType !== 'Snorkelling Site';
    const links = isProvider ? extractProviderLinks(p.moreInfo) : { url: undefined, sameAs: undefined };
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
      ...(links.url ? { url: links.url } : {}),
      ...(links.sameAs ? { sameAs: links.sameAs } : {})
    };
  });
}

async function getPlaceForSeo(siteName: string) {
  const site = await FeatureModel.findOne(
    { 'properties.name': siteName, showOnMap: { $in: ['Production', 'Development'] } },
    { location: 1, properties: 1 }
  ).lean();

  if (!site) return null;

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
    res.status(500).send(error);
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