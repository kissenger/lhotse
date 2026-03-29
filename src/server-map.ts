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
    console.log(error);
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
    addressLocality: location.locality || location.postalTown,
    addressRegion: location.county,
    streetAddress: location.adminLevel3,
    postalCode: location.postcode || location.postalCode,
    addressCountry: location.country || location.countryCode
  } as any;

  const hasAddressValue = Object.entries(address)
    .some(([key, value]) => key !== '@type' && !!value);

  return hasAddressValue ? address : undefined;
}

async function getPlacesForSeo() {
  const sites = await FeatureModel.find(
    { showOnMap: { $in: ['Production', 'Development'] } },
    { location: 1, properties: 1 }
  ).lean();

  return sites.map((site: any) => {
    const coords = site.location?.coordinates || [];
    const categories = site.properties?.categories || [];
    return {
      '@type': 'Place',
      name: site.properties?.name,
      description: site.properties?.featureType + ': ' + site.properties?.description,
      keywords: categories.length ? categories.join(', ') : undefined,
      address: toPostalAddress(site.properties?.location),
      geo: {
        '@type': 'GeoCoordinates',
        latitude: coords[1],
        longitude: coords[0]
      }
    };
  });
}

export { map, getPlacesForSeo };

/* Admin CRUD endpoints */

map.get('/api/sites/get-all-sites-admin/', verifyToken, async (req, res) => {
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