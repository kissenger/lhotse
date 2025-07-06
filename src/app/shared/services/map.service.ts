import { Injectable } from '@angular/core';
import { mapboxToken } from '../globals';
import * as mapboxgl from 'mapbox-gl';

@Injectable({
  providedIn: 'root',
})

export class MapService {

  private _map?: mapboxgl.Map;
  private _startingBounds: mapboxgl.LngLatBoundsLike = [[-8.1597, 49.7212],[1.8482, 59.3700]];
  public selectedFeatureId: any = null;

  constructor() {
  }

  create(sites: any) {

    this._map = new mapboxgl.Map({
      accessToken: mapboxToken,
      container: 'map', 
      style: 'mapbox://styles/mapbox/standard',
      bounds: this._startingBounds,
      fitBoundsOptions: { padding: 15 },
    });

    this._map.on('style.load', () => {

      this._map?.addSource('sitesSource', {
        type: "geojson", 
        data: sites,
        // generateId: true
      });

      this._map?.addLayer({
        id: 'sitesLayer', 
        source: 'sitesSource',
        type: 'circle', 
        paint: {
          'circle-color': '#4264fb',
          'circle-radius': 4,
          'circle-stroke-width': 2,
          'circle-stroke-color': '#ffffff'
        }
      })

    })

    this._map.addInteraction('click', {
      type: 'click',
      target: { layerId: 'sitesLayer' },
      handler: ({ feature }) => {
        // if (this.selectedFeature) {
        //   this._map!.setFeatureState(this.selectedFeature, { selected: false });
        // }
        this.selectedFeatureId = feature?.id;

        // this._map!.setFeatureState(feature!, { selected: true });
      }
    });

    this._map.addInteraction('map-click', {
      type: 'click',
      handler: () => {
        if (this.selectedFeatureId) {
          // this._map!.setFeatureState(this.selectedFeature, { selected: false });
          this.selectedFeatureId = null;
        }
      }
    });

    this._map.addInteraction('mouseenter', {
      type: 'mouseenter',
      target: { layerId: 'sitesLayer' },
      handler: () => { this._map!.getCanvas().style.cursor = 'pointer'; }
    });

    this._map.addInteraction('mouseleave', {
      type: 'mouseleave',
      target: { layerId: 'sitesLayer' },
      handler: () => { this._map!.getCanvas().style.cursor = ''; }
    });

  }

}