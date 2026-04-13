import { Injectable } from '@angular/core';
import { mapboxToken } from '../globals';
import type * as mapboxgl from 'mapbox-gl';
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

  async create(sites: any) {

    const mapboxgl = (await import('mapbox-gl')).default;

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

        // 1×1 white pixel — kept for potential future use but no longer applied to labels
        this._map?.addImage('label-bg', { width: 1, height: 1, data: new Uint8Array([255, 255, 255, 230]) });

        this._map?.addSource('sitesSource', {
          type: 'geojson',
          data: sites,
          cluster: true,
          clusterMaxZoom: 14,
          clusterRadius: 50,
          // count how many features in each cluster are Snorkelling Sites
          clusterProperties: {
            siteCount: ['+', ['case', ['==', ['get', 'featureType'], 'Snorkelling Site'], 1, 0]],
          },
        });

        // cluster bubble layer
        this._map?.addLayer({
          id: 'clusterLayer',
          type: 'circle',
          source: 'sitesSource',
          filter: ['has', 'point_count'],
          paint: {
            'circle-color': [
              'case',
              ['==', ['get', 'siteCount'], 0],                         // all orgs
              '#E87722',
              '#1D3D59',                                               // all sites, or mixed (ring handles mixed)
            ],
            'circle-radius': ['step', ['get', 'point_count'], 18, 10, 24, 50, 30],
            'circle-opacity': 0.85,
          },
        });

        // outer ring layer — only shown on mixed clusters (contains both types)
        this._map?.addLayer({
          id: 'clusterRingLayer',
          type: 'circle',
          source: 'sitesSource',
          filter: ['all',
            ['has', 'point_count'],
            ['>', ['get', 'siteCount'], 0],
            ['<', ['get', 'siteCount'], ['get', 'point_count']],
          ],
          paint: {
            'circle-color': 'transparent',
            'circle-radius': ['step', ['get', 'point_count'], 21, 10, 27, 50, 33],
            'circle-stroke-width': 3,
            'circle-stroke-color': '#E87722',
            'circle-opacity': 0,
          },
        });

        // cluster count label layer
        this._map?.addLayer({
          id: 'clusterCountLayer',
          type: 'symbol',
          source: 'sitesSource',
          filter: ['has', 'point_count'],
          layout: {
            'text-field': '{point_count_abbreviated}',
            'text-size': 13,
            'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Bold'],
          },
          paint: { 'text-color': '#ffffff' },
        });

        // single unclustered symbol layer — data-driven colour + feature-state for selection
        // organisations are rendered slightly smaller than sites to reinforce hierarchy
        this._map?.addLayer({
          id: 'symbolLayer',
          type: 'circle',
          source: 'sitesSource',
          filter: ['!', ['has', 'point_count']],
          layout: {
            'circle-sort-key': ['get', 'symbolSortOrder'],
          },
          paint: {
            'circle-color': [
              'case',
              ['boolean', ['feature-state', 'selected'], false],
              '#ffffff',
              ['match', ['get', 'featureType'], 'Snorkelling Site', '#1D3D59', '#E87722'],
            ],
            'circle-radius': ['interpolate', ['exponential', 1.5], ['zoom'], 5, 7, 14, 11],
            'circle-stroke-width': [
              'case',
              ['boolean', ['feature-state', 'selected'], false],
              3,
              0,
            ],
            'circle-stroke-color': [
              'match', ['get', 'featureType'], 'Snorkelling Site', '#1D3D59', '#E87722',
            ],
            'circle-pitch-alignment': 'map',
          },
        });

        // label layer — site/org name shown at zoom >= 8
        this._map?.addLayer({
          id: 'symbolLabelLayer',
          type: 'symbol',
          source: 'sitesSource',
          filter: ['!', ['has', 'point_count']],
          minzoom: 6,
          layout: {
            'text-field': ['get', 'name'],
            'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Regular'],
            'text-size': 15,
            // 'icon-image': 'label-bg',
            // 'icon-text-fit': 'both',
            // 'icon-text-fit-padding': [4, 8, 4, 8],
            // variable-anchor lets Mapbox pick the best side to avoid collisions;
            // radial-offset scales with zoom so text stays outside the growing circle
            'text-variable-anchor': ['top', 'bottom', 'right', 'left'],
            'text-radial-offset': ['interpolate', ['linear'], ['zoom'], 5, 0.9, 14, 1.8],
            'text-optional': true,
            'text-max-width': 8,
            'symbol-sort-key': ['get', 'symbolSortOrder'],
          },
          paint: {
            'text-color': ['match', ['get', 'featureType'], 'Snorkelling Site', '#1D3D59', '#E87722'],
            'text-halo-color': 'rgba(255, 255, 255, 0.6)',
            'text-halo-width': 1,
          },
        });

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

      this._map?.addInteraction('cluster-click', {
        type: 'click',
        target: { layerId: 'clusterLayer' },
        handler: (e) => {
          const features = this._map?.queryRenderedFeatures(e.point, { layers: ['clusterLayer'] });
          if (!features?.length) return;
          const clusterId = features[0].properties?.['cluster_id'];
          const source = this._map?.getSource('sitesSource') as mapboxgl.GeoJSONSource;
          source.getClusterExpansionZoom(clusterId, (err: any, zoom: number | null | undefined) => {
            if (err || zoom == null) return;
            this._map?.easeTo({ center: (features[0].geometry as any).coordinates, zoom });
          });
        },
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

      this._map?.addInteraction('cluster-mouseenter', {
        type: 'mouseenter',
        target: { layerId: 'clusterLayer' },
        handler: (_e) => {
          this._map!.getCanvas().style.cursor = 'pointer';
        },
      });

      this._map?.addInteraction('mouseleave', {
        type: 'mouseleave',
        target: { layerId: 'symbolLayer' },
        handler: (_e) => { 
          this._map!.getCanvas().style.cursor = '';
        }
      });

      this._map?.addInteraction('cluster-mouseleave', {
        type: 'mouseleave',
        target: { layerId: 'clusterLayer' },
        handler: (_e) => {
          this._map!.getCanvas().style.cursor = '';
        },
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

  fitBoundsToFeatures(features: any[], selectId?: number) {
    if (!features.length) return;
    let minLng = Infinity, maxLng = -Infinity, minLat = Infinity, maxLat = -Infinity;
    for (const f of features) {
      const [lng, lat] = f.geometry.coordinates;
      if (lng < minLng) minLng = lng;
      if (lng > maxLng) maxLng = lng;
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
    }
    if (this.selectedFeature) {
      this._map!.setFeatureState(this.selectedFeature, { selected: false });
      this.selectedFeature = null;
    }
    this._map!.fitBounds([[minLng, minLat], [maxLng, maxLat]], { padding: 60, maxZoom: 14 });
    if (selectId !== undefined) {
      this._map!.once('moveend', () => {
        const ref = { source: 'sitesSource', id: selectId };
        this._map!.setFeatureState(ref, { selected: true });
        this.selectedFeature = ref;
        this.selectionChanged.next();
      });
    }
  }

  flyToAndSelect(id: number, coordinates: [number, number], zoom = 12) {
    if (this.selectedFeature) {
      this._map!.setFeatureState(this.selectedFeature, { selected: false });
      this.selectedFeature = null;
    }
    this._map!.flyTo({ center: coordinates, zoom });
    this._map!.once('moveend', () => {
      const ref = { source: 'sitesSource', id };
      this._map!.setFeatureState(ref, { selected: true });
      this.selectedFeature = ref;
      this.selectionChanged.next();
    });
  }

}