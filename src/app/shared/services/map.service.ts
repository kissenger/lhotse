import { Injectable } from '@angular/core';
import { mapboxToken } from '../globals';
import * as mapboxgl from 'mapbox-gl';

@Injectable({
  providedIn: 'root',
})

export class MapService {

  private _map?: mapboxgl.Map;
  private _startingBounds: mapboxgl.LngLatBoundsLike = [[-8.1597, 49.7212],[1.8482, 59.3700]];

  constructor() {
  }

  create(sites: any) {

    this._map = new mapboxgl.Map({
      accessToken: mapboxToken,
      container: 'map', 
      style: 'mapbox://styles/mapbox/standard',
      bounds: [[-8.1597, 49.7212],[1.8482, 59.3700]],
      fitBoundsOptions: { padding: 15 },
    });

    this._map.on('style.load', () => {

      this._map?.addSource('sites', {
        type: "geojson", 
        data: sites
      });

      this._map?.addLayer({
        id: 'sitesLayer', 
        source: 'sites',
        type: 'circle', 
        paint: {
          'circle-color': '#4264fb',
          'circle-radius': 4,
          'circle-stroke-width': 2,
          'circle-stroke-color': '#ffffff'
        }
      })

    })

  }

}