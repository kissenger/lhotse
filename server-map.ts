import express from 'express';
import FeatureModel from './schema/feature';
import 'dotenv/config';

const map = express();

map.get('/api/sites/get-sites/:visibleOnly', async (req, res) => {
  // try {
    const sites = await FeatureModel.find({showOnMap: true});
    // console.log(sites);
    res.status(201).json(geoJson(sites));
  // } catch (error: any) {
  //   res.status(500).send(error);
  // }
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

export {map};