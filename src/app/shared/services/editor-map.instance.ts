import * as mapboxgl from 'mapbox-gl';
import { Subject } from 'rxjs';
import { mapboxToken } from '../globals';

const OUTDOORS  = 'mapbox://styles/mapbox/outdoors-v12';
const SATELLITE = 'mapbox://styles/mapbox/satellite-streets-v12';
const UK_CENTER: [number, number] = [-3.5, 54.5];

export interface EditorMapInitOpts {
  containerId: string;
  /** [lng, lat] — pass [0, 0] or omit for "no coords yet" */
  coords?: [number, number] | null;
  markerColor: string;
  markerZoom?: number;
  fallbackCenter?: [number, number];
  fallbackZoom?: number;
  /** When true, map clicks emit via click$ */
  clickToPlace?: boolean;
}

/**
 * Encapsulates a single Mapbox editor map + draggable marker.
 * Instantiate directly (not via Angular DI) so two independent
 * instances can coexist in the same component.
 */
export class EditorMapInstance {

  private _map: mapboxgl.Map | null = null;
  private _marker: mapboxgl.Marker | null = null;
  private _satellite = false;

  /** Emits [lng, lat] on marker dragend */
  readonly dragEnd$ = new Subject<[number, number]>();

  /** Emits [lng, lat] on map background click (only when clickToPlace=true) */
  readonly click$ = new Subject<[number, number]>();

  get satellite() { return this._satellite; }
  get exists()    { return !!this._map; }

  init(opts: EditorMapInitOpts) {
    this.destroy();

    const {
      containerId,
      coords,
      markerColor,
      markerZoom     = 12,
      fallbackCenter = UK_CENTER,
      fallbackZoom   = 5,
      clickToPlace   = false,
    } = opts;

    const hasCoords = !!(coords?.[0] || coords?.[1]);
    const center: [number, number] = hasCoords ? coords! : fallbackCenter;

    this._map = new mapboxgl.Map({
      accessToken: mapboxToken,
      container: containerId,
      style: OUTDOORS,
      center,
      zoom: hasCoords ? markerZoom : fallbackZoom,
    });
    this._map.once('load', () => this._map!.resize());
    this._satellite = false;

    this._marker = new mapboxgl.Marker({ draggable: true, color: markerColor })
      .setLngLat(center)
      .addTo(this._map);

    if (!hasCoords) {
      this._marker.getElement().style.display = 'none';
    }

    this._marker.on('dragend', () => {
      const ll = this._marker!.getLngLat();
      this.dragEnd$.next([
        parseFloat(ll.lng.toFixed(6)),
        parseFloat(ll.lat.toFixed(6)),
      ]);
    });

    if (clickToPlace) {
      this._map.on('click', (e) => {
        this.click$.next([
          parseFloat(e.lngLat.lng.toFixed(6)),
          parseFloat(e.lngLat.lat.toFixed(6)),
        ]);
      });
    }
  }

  destroy() {
    this._map?.remove();
    this._map    = null;
    this._marker = null;
    this._satellite = false;
  }

  /** Toggle between satellite and outdoors style. Returns the new state. */
  toggleSatellite(): boolean {
    this._satellite = !this._satellite;
    this._map?.setStyle(this._satellite ? SATELLITE : OUTDOORS);
    return this._satellite;
  }

  /** Move the marker to the given coordinates, show it, and pan/fly the map. */
  updateMarker(lng: number, lat: number, opts?: { fly?: boolean; zoom?: number }) {
    if (!this._map || !this._marker) return;
    this._marker.setLngLat([lng, lat]);
    this._marker.getElement().style.display = '';
    if (opts?.fly) {
      this._map.flyTo({ center: [lng, lat], zoom: opts.zoom });
    } else {
      this._map.panTo([lng, lat]);
    }
  }

  /** Jump the map viewport without moving the marker. */
  jumpTo(lng: number, lat: number, zoom: number) {
    this._map?.jumpTo({ center: [lng, lat], zoom });
  }

  hideMarker() {
    if (this._marker) this._marker.getElement().style.display = 'none';
  }
}
