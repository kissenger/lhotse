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

      this._map?.loadImage('assets/icons/mask-and-snorkel-white-on-dark-2.png', (error, image: any) => {
        if (error) throw error;
        this._map?.addImage('site-marker', image);
      });

      this._map?.addSource('sitesSource', {
        type: "geojson", 
        data: sites
      });

      // this._map?.addLayer({
      //   id: 'pointsLayer', 
      //   source: 'sitesSource',
      //   type: 'circle', 
      //   paint: { 
      //     'circle-radius': 20,
      //     'circle-color': '#1D3D59'
      //   }
      // })

      this._map?.addLayer({
        id: 'symbolLayer', 
        source: 'sitesSource',
        type: 'symbol', 
        layout: { 
          'icon-image': 'site-marker',
          'icon-allow-overlap': true,
          'icon-anchor': 'bottom'
        }
      })



    })

    this._map.addInteraction('click', {
      type: 'click',
      target: { layerId: 'symbolLayer' },
      handler: ({ feature }) => {
        if (this.selectedFeatureId === feature?.id) {
          this.selectedFeatureId = null;
        } else {
          this.selectedFeatureId = feature?.id;
        }
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
      target: { layerId: 'symbolLayer' },
      handler: (e) => { 
        // console.log(e);
        this._map!.getCanvas().style.cursor = 'pointer';
        // this._map!.setFeatureState(e.feature!, {hovered: true});
        // console.log(e.feature!.state)
        // this._map!.setLayoutProperty('')
      }
    });

    this._map.addInteraction('mouseleave', {
      type: 'mouseleave',
      target: { layerId: 'symbolLayer' },
      handler: (e) => { 
        // console.log(e)
        this._map!.getCanvas().style.cursor = ''; 
        // this._map!.setFeatureState({source: 'sitesSource', id: e.feature!.id!}, {hovered: false});
        // this._map!.setFeatureState(e.feature!, {hovered: true});
        // console.log(e.feature!.state)

      }
    });

  }

}