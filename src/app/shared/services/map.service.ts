import { Injectable, Injector, ProviderToken } from '@angular/core';
import { mapboxToken } from '../globals';
import * as mapboxgl from 'mapbox-gl';

@Injectable({
  providedIn: 'root'
})

export class MapService {

  private _map?: mapboxgl.Map;
  private _startingBounds: mapboxgl.LngLatBoundsLike = [[-8.1597, 49.7212],[1.8482, 59.3700]];
  public selectedFeature: any = null;
  private _sites: any;

  constructor(
    private injector: Injector
  ) {}
  
  get exists() {
    return !!this._map
  }

  deselectSymbol() {
    this._map!.setFeatureState(this.selectedFeature, { selected: false });
    this.selectedFeature = null;
  }

  get selectedSymbolId() {
    return this.selectedFeature?.id;
  }

  get popupPosition() {
    // let width = this._map?.getContainer().clientWidth;
    if (!!this.selectedSymbolId) {
      let lngLat = this._sites.features[this.selectedSymbolId].geometry.coordinates;
      let xy = this._map?.project(lngLat);
      if (xy!.x < 350) {
        return "right"
      } else {
        return "left"
      }
    } else {
      return "none"
    }

  }

  create(sites: any) {

    return new Promise<void>( (resolve, reject) => {

      this._sites = sites;

      this._map = new mapboxgl.Map({
        accessToken: mapboxToken,
        container: 'map', 
        style: 'mapbox://styles/mapbox/standard',
        bounds: this._startingBounds,
        fitBoundsOptions: { padding: 15 },
      });

      this._map?.on('error', (error) => {
        reject(error);
      })

      this._map?.on('load', () => {
        resolve();
      })

      this._map?.on('style.load', () => {

        this._map?.loadImage('assets/icons/mask-and-snorkel-white-on-dark-2.png', (error, image: any) => {
          if (error) throw error;
          this._map?.addImage('site-marker-blue', image);
        });

        this._map?.loadImage('assets/icons/mask-and-snorkel-white-on-yellow-2.png', (error, image: any) => {
          if (error) throw error;
          this._map?.addImage('site-marker-yellow', image);
        });      

        this._map?.addSource('sitesSource', {
          type: "geojson", 
          data: sites
        });

        this._map?.addLayer({
          id: 'symbolLayer', 
          source: 'sitesSource',
          type: 'symbol', 
          layout: { 
            'icon-image': 'site-marker-blue',
            'icon-allow-overlap': true,
            'icon-anchor': 'bottom'
          },
        })

        this._map?.addLayer({
          id: 'symbolLayerHighlight', 
          source: 'sitesSource',
          type: 'symbol', 
          layout: { 
            'icon-image': 'site-marker-yellow',
            'icon-allow-overlap': true,
            'icon-anchor': 'bottom',
            'icon-size': 1.1,
            'icon-offset': [0,2]
          },
          paint: {
            'icon-opacity': [
              'case',
              ['boolean', ['feature-state', 'selected'], false],
              1.0,
              0
            ],
          }
        })      

      })

      this._map?.addInteraction('click', {
        type: 'click',
        target: { layerId: 'symbolLayer' },
        handler: ({feature}) => {
          if (this.selectedFeature?.id === feature?.id) {
            this.selectedFeature = null;
            this._map!.setFeatureState(feature!, { selected: false });
          } else {
            if (this.selectedFeature) {
              this._map!.setFeatureState(this.selectedFeature, { selected: false });
            }
            this.selectedFeature = feature;
            this._map!.setFeatureState(feature!, { selected: true });
          }
        }

      });

      this._map?.addInteraction('map-click', {
        type: 'click',
        handler: () => {
          if (this.selectedFeature?.id) {
            this._map!.setFeatureState(this.selectedFeature, { selected: false });
            this.selectedFeature = null;
          }
        }
      });

      this._map?.addInteraction('mouseenter', {
        type: 'mouseenter',
        target: { layerId: 'symbolLayer' },
        handler: (e) => { 
          this._map!.getCanvas().style.cursor = 'pointer';
        }
      });

      this._map?.addInteraction('mouseleave', {
        type: 'mouseleave',
        target: { layerId: 'symbolLayer' },
        handler: (e) => { 
          this._map!.getCanvas().style.cursor = '';
        }
      });
    
    });


  }

}