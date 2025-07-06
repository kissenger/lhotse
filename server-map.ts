import express from 'express';
import SiteModel from './schema/site';
import 'dotenv/config';
import { features } from 'process';

const map = express();

map.get('/api/sites/get-sites/:visibleOnly', async (req, res) => {
  try {
    const sites = await SiteModel.find({showOnMap: true});
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
      properties: s.info
    }))
  }
}

export {map};