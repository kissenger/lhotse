import { Component, AfterViewInit, OnDestroy, ChangeDetectorRef, Inject } from '@angular/core';
import { DOCUMENT, DatePipe } from '@angular/common';
import { HttpService } from '@shared/services/http.service';
import { MapFeature } from '@shared/types';
import { mapboxToken } from '@shared/globals';
import * as mapboxgl from 'mapbox-gl';
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
        if (links) s.properties.researchNotes.links = this._cleanLinks(links);
        return s;
      });
      this._initMap();
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

  private _initMap() {
    this._map = new mapboxgl.Map({
      accessToken: mapboxToken,
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

  private _cleanLinks(raw: any): string[] {
    if (!raw) return [];
    if (typeof raw === 'string') {
      try { raw = JSON.parse(raw); } catch { raw = [raw]; }
    }
    if (!Array.isArray(raw)) return [];
    return raw
      .map((l: any) => String(l).replace(/^[\s["']+|[\s\]"']+$/g, '').trim())
      .filter((l: string) => /^https?:\/\//i.test(l));
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

  clearSelection() {
    this.selectedSite = null;
  }

  openInFeaturesEditor() {
    if (this.selectedSite?._id) {
      this._window.open(`/siteseditor`, '_blank', 'noopener,noreferrer');
    }
  }
}
