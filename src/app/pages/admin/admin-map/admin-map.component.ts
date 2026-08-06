import { Component, AfterViewInit, OnDestroy, ChangeDetectorRef, Inject } from '@angular/core';
import { DOCUMENT, DatePipe } from '@angular/common';
import { HttpService } from '@shared/services/http.service';
import { MapFeature } from '@shared/types';
import { mapboxToken } from '@shared/globals';
import { normaliseResearchLinks } from '@shared/research-links';
import type * as mapboxgl from 'mapbox-gl';
import { loadMapboxFromCdn } from '@shared/services/mapbox-cdn-loader';
import { ToastService } from '@shared/services/toast.service';

type SiteStatus = 'visited-production' | 'visited-hidden' | 'unvisited-priority' | 'unvisited';

interface FilterCategory {
  status: SiteStatus;
  label: string;
  color: string;
  enabled: boolean;
}

function getSiteStatus(site: MapFeature): SiteStatus {
  const visited = site.properties.researchNotes.isVisited;
  const production = site.showOnMap === 'Production';
  const priority = site.properties.researchNotes.visitPriority;
  if (visited && production) return 'visited-production';
  if (visited && !production) return 'visited-hidden';
  if (!visited && priority) return 'unvisited-priority';
  return 'unvisited';
}

@Component({
  selector: 'app-admin-map',
  standalone: true,
  imports: [DatePipe],
  templateUrl: './admin-map.component.html',
  styleUrl: './admin-map.component.css',
})
export class AdminMapComponent implements AfterViewInit, OnDestroy {

  private _map: mapboxgl.Map | null = null;
  private _allSites: MapFeature[] = [];
  private _window: Window;

  public loadingState: 'loading' | 'failed' | 'success' = 'loading';
  public selectedSite: MapFeature | null = null;
  public visibleCount = 0;
  public isLocating = false;
  public userLocationCoords: [number, number] | null = null;

  readonly categories: FilterCategory[] = [
    { status: 'visited-production', label: 'Visited & on map',       color: '#2d9e2d', enabled: true },
    { status: 'visited-hidden',     label: 'Visited & hidden',        color: '#e07820', enabled: true },
    { status: 'unvisited-priority', label: 'Not visited – priority',  color: '#cc2222', enabled: true },
    { status: 'unvisited',          label: 'Not visited',             color: '#888888', enabled: true },
  ];

  constructor(
    private _http: HttpService,
    private _cdr: ChangeDetectorRef,
    private _toaster: ToastService,
    @Inject(DOCUMENT) _document: Document,
  ) {
    this._window = _document.defaultView!;
  }

  async ngAfterViewInit() {
    try {
      const raw = await this._http.getAllSitesAdmin();
      this._allSites = raw.map(s => {
        const links = s.properties?.researchNotes?.links;
        if (links) s.properties.researchNotes.links = normaliseResearchLinks(links);
        return s;
      });
      await this._initMap();
    } catch {
      this.loadingState = 'failed';
      this._toaster.show('Failed to load sites', 'error');
      this._cdr.detectChanges();
    }
  }

  ngOnDestroy() {
    this._map?.remove();
    this._map = null;
  }

  private async _initMap() {
    const mapboxgl = await loadMapboxFromCdn(this._window.document);
    mapboxgl.accessToken = mapboxToken;

    this._map = new mapboxgl.Map({
      container: 'admin-map',
      style: 'mapbox://styles/mapbox/outdoors-v12',
      bounds: [[-8.16, 49.72], [1.85, 59.37]],
      fitBoundsOptions: { padding: 20 },
    });

    this._map.once('load', () => {
      this._map!.addSource('admin-sites', {
        type: 'geojson',
        data: this._buildGeoJson(),
      });

      this._map!.addSource('user-location', {
        type: 'geojson',
        data: this._buildUserLocationGeoJson(),
      });

      this._map!.addLayer({
        id: 'admin-sites-circles',
        type: 'circle',
        source: 'admin-sites',
        paint: {
          'circle-radius': 7,
          'circle-stroke-width': 1.5,
          'circle-stroke-color': '#fff',
          'circle-color': [
            'match', ['get', 'status'],
            'visited-production', '#2d9e2d',
            'visited-hidden',     '#e07820',
            'unvisited-priority', '#cc2222',
            /* default */         '#888888',
          ],
        },
      });

      this._map!.addLayer({
        id: 'user-location-ring',
        type: 'circle',
        source: 'user-location',
        paint: {
          'circle-radius': 12,
          'circle-color': '#1f8df3',
          'circle-opacity': 0.25,
          'circle-stroke-width': 0,
        },
      });

      this._map!.addLayer({
        id: 'user-location-dot',
        type: 'circle',
        source: 'user-location',
        paint: {
          'circle-radius': 5,
          'circle-color': '#1f8df3',
          'circle-stroke-color': '#ffffff',
          'circle-stroke-width': 2,
        },
      });

      this._map!.on('click', 'admin-sites-circles', (e) => {
        const id = e.features?.[0]?.properties?.['id'];
        this.selectedSite = this._allSites.find(s => s._id === id) ?? null;
        this._cdr.detectChanges();
      });

      this._map!.on('mouseenter', 'admin-sites-circles', () => {
        this._map!.getCanvas().style.cursor = 'pointer';
      });
      this._map!.on('mouseleave', 'admin-sites-circles', () => {
        this._map!.getCanvas().style.cursor = '';
      });

      this.loadingState = 'success';
      this.visibleCount = this._buildGeoJson().features.length;
      this._cdr.detectChanges();
    });
  }

  private _buildGeoJson(): GeoJSON.FeatureCollection {
    const enabledStatuses = new Set(
      this.categories.filter(c => c.enabled).map(c => c.status)
    );
    return {
      type: 'FeatureCollection',
      features: this._allSites
        .filter(s => {
          const [lng, lat] = s.location.coordinates;
          return (lng || lat) && s.properties.featureType === 'Snorkelling Site' && enabledStatuses.has(getSiteStatus(s));
        })
        .map(s => ({
          type: 'Feature' as const,
          geometry: { type: 'Point' as const, coordinates: s.location.coordinates },
          properties: {
            id: s._id,
            name: s.properties.name,
            status: getSiteStatus(s),
          },
        })),
    };
  }

  private _updateSource() {
    const source = this._map?.getSource('admin-sites') as mapboxgl.GeoJSONSource | undefined;
    source?.setData(this._buildGeoJson());
  }

  private _buildUserLocationGeoJson(coords: [number, number] | null = this.userLocationCoords): GeoJSON.FeatureCollection {
    if (!coords) {
      return { type: 'FeatureCollection', features: [] };
    }
    return {
      type: 'FeatureCollection',
      features: [{
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: coords,
        },
        properties: {},
      }],
    };
  }

  private _updateUserLocationSource() {
    const source = this._map?.getSource('user-location') as mapboxgl.GeoJSONSource | undefined;
    source?.setData(this._buildUserLocationGeoJson());
  }

  toggleFilter(cat: FilterCategory) {
    cat.enabled = !cat.enabled;
    this._updateSource();
    this.visibleCount = this._buildGeoJson().features.length;
    this._cdr.detectChanges();
  }

  getCategoryCount(status: SiteStatus): number {
    return this._allSites.filter(s => s.properties.featureType === 'Snorkelling Site' && getSiteStatus(s) === status).length;
  }

  toggleFilterPanel() {
    // no-op: legend is always visible
  }

  zoomIn() {
    this._map?.zoomIn();
  }

  zoomOut() {
    this._map?.zoomOut();
  }

  zoomToUserLocation() {
    if (this.isLocating) return;
    if (!this._map) {
      this._toaster.show('Map is not ready yet', 'error');
      return;
    }
    if (!('geolocation' in this._window.navigator)) {
      this._toaster.show('Geolocation is not available in this browser', 'error');
      return;
    }

    this.isLocating = true;
    this._window.navigator.geolocation.getCurrentPosition(
      (position: GeolocationPosition) => {
        const { latitude, longitude } = position.coords;
        this.userLocationCoords = [longitude, latitude];
        this._updateUserLocationSource();
        this._map?.flyTo({ center: [longitude, latitude], zoom: Math.max(this._map.getZoom(), 12), essential: true });
        this.isLocating = false;
        this._cdr.detectChanges();
      },
      (_error: GeolocationPositionError) => {
        this._toaster.show('Unable to get your location. Check browser permissions.', 'error');
        this.isLocating = false;
        this._cdr.detectChanges();
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000,
      }
    );
  }

  clearSelection() {
    this.selectedSite = null;
  }

  openInFeaturesEditor() {
    if (this.selectedSite?._id) {
      this._window.open(`/siteseditor`, '_blank', 'noopener,noreferrer');
    }
  }
}
