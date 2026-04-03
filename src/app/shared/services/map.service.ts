import { Injectable } from '@angular/core';
import { mapboxToken } from '../globals';
import * as mapboxgl from 'mapbox-gl';
import { Subject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})

export class MapService {

  private _map?: mapboxgl.Map;
  private _startingBounds: mapboxgl.LngLatBoundsLike = [[-8.1597, 49.7212],[1.8482, 59.3700]];
  public selectedFeature: any = null;
  private _sites: any;
  // Emits whenever the selected feature changes (including clear)
  public readonly selectionChanged = new Subject<void>();

  constructor() {}
  
  get exists() {
    return !!this._map
  }

  deselectSymbol() {
    this._map!.setFeatureState(this.selectedFeature, { selected: false });
    this.selectedFeature = null;
    this.selectionChanged.next();
  }

  get selectedSymbolId() {
    return this.selectedFeature?.id;
  }

  get popupPosition() {
    //cant use !!selectedSymbolId as this filters out id=0
    if (typeof this.selectedSymbolId === "number") {
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

  indexOfArrayMaximum(arr: Array<number> | undefined) {
    if (arr === undefined) return -1
    let max = arr[0];
    let index = 0;
    for (let i = 1; i < arr.length; i++) {
      if (arr[i] > max) {
        index = i;
        max = arr[i];
      }
    }
    return index;
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

      const fullscreenContainer = this._map.getContainer().parentElement ?? undefined;

      // Custom fullscreen control with text label
      const fullscreenCtrl: mapboxgl.IControl = {
        onAdd: () => {
          const div = document.createElement('div');
          div.className = 'mapboxgl-ctrl mapboxgl-ctrl-group expand-ctrl';
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'expand-btn';
          const expandSvg = '<svg class="ctrl-icon" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path d="M3 3h5v2H5v3H3V3zm9 0h5v5h-2V5h-3V3zM3 12h2v3h3v2H3v-5zm14 0v5h-5v-2h3v-3h2z"/></svg>';
          const shrinkSvg = '<svg class="ctrl-icon" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path d="M5 8h5V3H8v3H5v2zm10 0v-2h-3V3h-2v5h5zM5 12h3v3h2v-5H5v2zm7 0v5h2v-3h3v-2h-5z"/></svg>';
          btn.innerHTML = expandSvg + '<strong>Expand</strong>';
          btn.addEventListener('click', () => {
            const target = fullscreenContainer ?? this._map!.getContainer();
            if (!document.fullscreenElement) {
              target.requestFullscreen();
              btn.innerHTML = shrinkSvg + '<strong>Shrink</strong>';
            } else {
              document.exitFullscreen();
              btn.innerHTML = expandSvg + '<strong>Expand</strong>';
            }
          });
          document.addEventListener('fullscreenchange', () => {
            if (!document.fullscreenElement) {
              btn.innerHTML = expandSvg + '<strong>Expand</strong>';
            }
          });
          div.appendChild(btn);
          return div;
        },
        onRemove: () => {},
      };
      this._map.addControl(fullscreenCtrl, 'top-right');

      this._map?.on('error', (error) => { reject(error); })
      this._map?.on('load', () => {       resolve(); })
      this._map?.on('style.load', () => {

        this._map?.loadImage('assets/icons/site-icon-blue-white.webp', (error, image: any) => {
          if (error) throw error;
          this._map?.addImage('site-marker', image);
        });

        this._map?.loadImage('assets/icons/site-icon-white-blue.webp', (error, image: any) => {
          if (error) throw error;
          this._map?.addImage('site-marker-active', image);
        });

        this._map?.loadImage('assets/icons/provider-icon-orange.webp', (error, image: any) => {
          if (error) throw error;
          this._map?.addImage('organisation-marker', image);
        });

        this._map?.loadImage('assets/icons/provider-icon-white-orange.webp', (error, image: any) => {
          if (error) throw error;
          this._map?.addImage('organisation-marker-active', image);
        });

        this._map?.addSource('sitesSource', {type: "geojson", data: sites});

        // main symbol layer
        this._map?.addLayer({
          id: 'symbolLayer', 
          source: 'sitesSource',
          type: 'symbol', 
          layout: { 
            'icon-image': ['match', ['get','featureType'], 
                'Snorkelling Site', 'site-marker',
                'organisation-marker'],
            'icon-allow-overlap': true,
            'icon-anchor': 'bottom',
            'icon-size': ['interpolate', ['exponential', 2], ['zoom'], 5, 0.5, 14, 1.6],
            'symbol-sort-key': ['get', 'symbolSortOrder']
          },
          paint: {
            'icon-opacity': [
              'case',
              ['boolean', ['feature-state', 'selected'], false],
              0,
              1.0
            ],
          }
        })

        // highlight layer — uses active icon variants, only shown when selected
        this._map?.addLayer({
          id: 'symbolLayerHighlight', 
          source: 'sitesSource',
          type: 'symbol', 
          layout: { 
            'icon-image': ['match', ['get','featureType'],
                'Snorkelling Site', 'site-marker-active',
                'organisation-marker-active'],
            'icon-allow-overlap': true,
            'icon-anchor': 'bottom',
            'icon-size': ['interpolate', ['exponential', 2], ['zoom'], 1, 0.5, 14, 1.6],
            'symbol-sort-key': ['get','symbolSortOrder']
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
        handler: (e) => {
          // look for multiple features under the click, and set the one with the highest sortOrder as selected
          // this should be the one highest in the stack
          const features = this._map?.queryRenderedFeatures(e.point, {layers: ['symbolLayer']});
          const index = this.indexOfArrayMaximum(features?.map(f=>f.properties!['symbolSortOrder']));
          const feature = features![index];

          if (this.selectedFeature?.id === feature?.id) {
            this.selectedFeature = null;
            this._map!.setFeatureState(feature!, { selected: false });
            this.selectionChanged.next();
          } else {
            if (this.selectedFeature) {
              this._map!.setFeatureState(this.selectedFeature, { selected: false });
            }
            this.selectedFeature = feature;
            this._map!.setFeatureState(feature!, { selected: true });
            this.selectionChanged.next();
          }
        }

      });

      this._map?.addInteraction('map-click', {
        type: 'click',
        handler: () => {
          if (this.selectedFeature?.id) {
            this._map!.setFeatureState(this.selectedFeature, { selected: false });
            this.selectedFeature = null;
            this.selectionChanged.next();
          }
        }
      });

      this._map?.addInteraction('mouseenter', {
        type: 'mouseenter',
        target: { layerId: 'symbolLayer' },
        handler: (_e) => { 
          this._map!.getCanvas().style.cursor = 'pointer';
        }
      });

      this._map?.addInteraction('mouseleave', {
        type: 'mouseleave',
        target: { layerId: 'symbolLayer' },
        handler: (_e) => { 
          this._map!.getCanvas().style.cursor = '';
        }
      });
    
    });


  }

  updateSourceData(data: any) {
    const source = this._map?.getSource('sitesSource');
    if (source) (source as any).setData(data);
  }

  clearSelection() {
    this.selectedFeature = null;
    this.selectionChanged.next();
  }

}