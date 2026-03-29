import { AfterViewInit, ChangeDetectorRef, Component, Inject, OnDestroy, OnInit } from '@angular/core';
import { HttpService } from '@shared/services/http.service';
import { MapFeature } from '@shared/types';
import { FormsModule } from '@angular/forms';
import { NgClass, DatePipe, DOCUMENT } from '@angular/common';
import { DomSanitizer, SafeUrl } from '@angular/platform-browser';
import * as mapboxgl from 'mapbox-gl';
import { mapboxToken } from '@shared/globals';

@Component({
  selector: 'app-features-editor',
  standalone: true,
  imports: [NgClass, FormsModule, DatePipe],
  templateUrl: './features-editor.component.html',
  styleUrl: './features-editor.component.css'
})
export class FeaturesEditorComponent implements OnInit, AfterViewInit, OnDestroy {

  private _window;
  private _map: mapboxgl.Map | null = null;
  private _marker: mapboxgl.Marker | null = null;
  private _parkingMap: mapboxgl.Map | null = null;
  private _parkingMarker: mapboxgl.Marker | null = null;

  public selectedSite: MapFeature = new MapFeature();
  public sites: Array<MapFeature> = [this.selectedSite];
  public askForConfirmation: boolean = false;
  public mainMapSatellite: boolean = false;
  public parkingMapSatellite: boolean = false;

  readonly featureTypes = [
    'Authors of Snorkelling Britain',
    'Snorkelling Retailer',
    'Wildlife Trust Marine Centre',
    'Outdoor Activities Provider',
    'Snorkel Club or School',
    'Snorkelling Site',
  ];
  readonly ratingOptions: Array<'good' | 'ok' | 'poor' | 'not for snorkelling' | ''> = ['', 'good', 'ok', 'poor', 'not for snorkelling'];
  readonly snorkellingCategories = ['Rocky Reef', 'Kelp/Wrack Forest', 'Snorkel Trail', 'Seagrass Meadow', 'Manmade Structure', 'Mearl Beds', 'Sand and Gravel', 'Tidal Pool', 'Chalk Reef', 'Wreck', 'Scottish Wildlife Trust', 'Snorkelling Britain'];
  readonly providerCategories = ['Snorkel Instructing', 'Snorkel Guiding/Tours', 'Boat Snorkelling', 'Kit Rental', 'Kit Purchase'];

  get availableCategories(): string[] {
    const all = this.selectedSite.properties.featureType === 'Snorkelling Site'
      ? this.snorkellingCategories
      : this.providerCategories;
    return all.filter(c => !this.selectedSite.properties.categories.includes(c));
  }

  addCategory(select: HTMLSelectElement) {
    const val = select.value;
    if (val && !this.selectedSite.properties.categories.includes(val)) {
      this.selectedSite.properties.categories.push(val);
    }
    select.value = '';
  }

  removeCategory(cat: string) {
    this.selectedSite.properties.categories = this.selectedSite.properties.categories.filter(c => c !== cat);
  }

  get nonSnorkellingSites() {
    return this.sites
      .filter(s => s.properties.featureType !== 'Snorkelling Site')
      .sort((a, b) => (a.properties.name || '').localeCompare(b.properties.name || ''));
  }

  get snorkellingSites() {
    return this.sites
      .filter(s => s.properties.featureType === 'Snorkelling Site')
      .sort((a, b) => (a.properties.name || '').localeCompare(b.properties.name || ''));
  }

  constructor(
    private _http: HttpService,
    private _cdr: ChangeDetectorRef,
    private _sanitizer: DomSanitizer,
    @Inject(DOCUMENT) private _document: Document
  ) {
    this._window = _document.defaultView;
  }

  async ngOnInit() {
    await this.getSites();
  }

  ngAfterViewInit() {
    this._initMap();
  }

  ngOnDestroy() {
    this._map?.remove();
    this._parkingMap?.remove();
  }

  private _initMap() {
    const [lng, lat] = this.selectedSite.location.coordinates;
    const hasCoords = !!(lng || lat);
    this._map = new mapboxgl.Map({
      accessToken: mapboxToken,
      container: 'features-edit-map',
      style: 'mapbox://styles/mapbox/outdoors-v12',
      center: hasCoords ? [lng, lat] : [-3.5, 54.5],
      zoom: hasCoords ? 12 : 5,
    });
    this._map.once('load', () => this._map!.resize());
    this._marker = new mapboxgl.Marker({ draggable: true, color: '#e05' })
      .setLngLat(hasCoords ? [lng, lat] : [-3.5, 54.5])
      .addTo(this._map);
    if (!hasCoords) {
      this._marker.getElement().style.display = 'none';
    }
    this._marker.on('dragend', () => {
      const lngLat = this._marker!.getLngLat();
      this.selectedSite.location.coordinates[0] = parseFloat(lngLat.lng.toFixed(6));
      this.selectedSite.location.coordinates[1] = parseFloat(lngLat.lat.toFixed(6));
      this._reverseGeocode(lngLat.lng, lngLat.lat);
      this._cdr.detectChanges();
    });
    this._map.on('click', (e) => {
      const [cx, cy] = this.selectedSite.location.coordinates;
      if (cx || cy) return; // already placed — drag to move
      this.selectedSite.location.coordinates[0] = parseFloat(e.lngLat.lng.toFixed(6));
      this.selectedSite.location.coordinates[1] = parseFloat(e.lngLat.lat.toFixed(6));
      this._marker!.setLngLat(e.lngLat);
      this._marker!.getElement().style.display = '';
      this._reverseGeocode(e.lngLat.lng, e.lngLat.lat);
      this._cdr.detectChanges();
    });
  }

  private _initParkingMap() {
    this._destroyParkingMap();
    const loc = this.selectedSite.properties.siteInfo.parking.location;
    if (!loc) return;
    const [lng, lat] = loc.coordinates;
    const hasCoords = !!(lng || lat);
    const siteLng = this.selectedSite.location.coordinates[0];
    const siteLat = this.selectedSite.location.coordinates[1];
    const hasSiteCoords = !!(siteLng || siteLat);
    const fallbackCenter: [number, number] = hasSiteCoords ? [siteLng, siteLat] : [-3.5, 54.5];
    const fallbackZoom = hasSiteCoords ? 15 : 5;
    this._parkingMap = new mapboxgl.Map({
      accessToken: mapboxToken,
      container: 'features-edit-parking-map',
      style: 'mapbox://styles/mapbox/outdoors-v12',
      center: hasCoords ? [lng, lat] : fallbackCenter,
      zoom: hasCoords ? 15 : fallbackZoom,
    });
    this._parkingMarker = new mapboxgl.Marker({ draggable: true, color: '#05e' })
      .setLngLat(hasCoords ? [lng, lat] : fallbackCenter);
    if (hasCoords) {
      this._parkingMarker.addTo(this._parkingMap);
    }
    this._parkingMarker.on('dragend', () => {
      const lngLat = this._parkingMarker!.getLngLat();
      const loc2 = this.selectedSite.properties.siteInfo.parking.location!;
      loc2.coordinates[0] = parseFloat(lngLat.lng.toFixed(6));
      loc2.coordinates[1] = parseFloat(lngLat.lat.toFixed(6));
      this._cdr.detectChanges();
    });
  }

  private _destroyParkingMap() {
    this._parkingMap?.remove();
    this._parkingMap = null;
    this._parkingMarker = null;
  }

  toggleMainMapSatellite() {
    this.mainMapSatellite = !this.mainMapSatellite;
    this._map?.setStyle(this.mainMapSatellite
      ? 'mapbox://styles/mapbox/satellite-streets-v12'
      : 'mapbox://styles/mapbox/outdoors-v12');
  }

  toggleParkingMapSatellite() {
    this.parkingMapSatellite = !this.parkingMapSatellite;
    this._parkingMap?.setStyle(this.parkingMapSatellite
      ? 'mapbox://styles/mapbox/satellite-streets-v12'
      : 'mapbox://styles/mapbox/outdoors-v12');
  }

  async getSites() {
    try {
      const result = await this._http.getAllSitesAdmin();
      this.refreshSiteList(result);
    } catch (error: any) {
      console.error(error);
      this._window!.alert(`Failed to load sites:\n${error?.error?.message || error}`);
    }
  }

  normaliseSite(raw: any): MapFeature {
    const defaults = new MapFeature();
    const site: MapFeature = { ...defaults, ...raw };
    site.location = { ...defaults.location, ...(raw.location ?? {}) };
    site.properties = {
      ...defaults.properties,
      ...(raw.properties ?? {}),
      location: { ...defaults.properties.location, ...(raw.properties?.location ?? {}) },
      contact: { ...defaults.properties.contact, ...(raw.properties?.contact ?? {}) },
      moreInfo: raw.properties?.moreInfo ?? [],
      siteInfo: {
        ...defaults.properties.siteInfo,
        ...(raw.properties?.siteInfo ?? {}),
        parking: {
          ...defaults.properties.siteInfo.parking,
          ...(raw.properties?.siteInfo?.parking ?? {}),
          location: raw.properties?.siteInfo?.parking?.location ?? null,
        },
      },
      researchNotes: { ...defaults.properties.researchNotes, ...(raw.properties?.researchNotes ?? {}),
        links: this._normaliseLinks(raw.properties?.researchNotes?.links) },
    };
    return site;
  }

  refreshSiteList(result: Array<MapFeature>) {
    if (!result || result.length === 0) {
      this.sites = [new MapFeature()];
    } else {
      this.sites = result.map(r => this.normaliseSite(r));
    }
    this.selectedSite = this.sites[0];
    this._placeMarker();
    if (this.selectedSite.properties.siteInfo.parking.location) {
      setTimeout(() => this._initParkingMap(), 0);
    } else {
      this._destroyParkingMap();
    }
    this._cdr.detectChanges();
  }

  onFormSelect(id: string) {
    this.selectedSite = this.sites.find(s => s._id === id) ?? this.sites[0];
    this._placeMarker();
    if (this.selectedSite.properties.siteInfo.parking.location) {
      setTimeout(() => this._initParkingMap(), 0);
    } else {
      this._destroyParkingMap();
    }
  }

  onNewSite() {
    const blank = new MapFeature();
    this.selectedSite = blank;
    if (this._marker) this._marker.getElement().style.display = 'none';
    this._map?.jumpTo({ center: [-3.5, 54.5], zoom: 5 });
    this._destroyParkingMap();
  }

  private _placeMarker() {
    if (!this._map || !this._marker) return;
    const [lng, lat] = this.selectedSite.location.coordinates;
    if (lng || lat) {
      this._marker.setLngLat([lng, lat]);
      this._marker.getElement().style.display = '';
      this._map.jumpTo({ center: [lng, lat], zoom: 12 });
    } else {
      this._marker.getElement().style.display = 'none';
      this._map.jumpTo({ center: [-3.5, 54.5], zoom: 5 });
    }
  }

  // Coordinates helpers
  getLng(): number { return this.selectedSite.location.coordinates[0]; }
  getLat(): number { return this.selectedSite.location.coordinates[1]; }

  get coordString(): string {
    const [lng, lat] = this.selectedSite.location.coordinates;
    return (lng || lat) ? `${lat}, ${lng}` : '';
  }

  setCoordString(v: string) {
    const parts = v.split(',').map(s => parseFloat(s.trim()));
    if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
      this.selectedSite.location.coordinates[1] = parseFloat(parts[0].toFixed(6));
      this.selectedSite.location.coordinates[0] = parseFloat(parts[1].toFixed(6));
      this._updateMarkerFromCoords();
      this._cdr.detectChanges();
    }
  }

  openInGoogleMaps() {
    const [lng, lat] = this.selectedSite.location.coordinates;
    this._window!.open(`https://www.google.com/maps?q=${lat},${lng}`, '_blank', 'noopener,noreferrer');
  }

  get parkingCoordString(): string {
    const loc = this.selectedSite.properties.siteInfo.parking.location;
    if (!loc) return '';
    const [lng, lat] = loc.coordinates;
    return (lng || lat) ? `${lat}, ${lng}` : '';
  }

  setParkingCoordString(v: string) {
    const parts = v.split(',').map(s => parseFloat(s.trim()));
    if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
      const loc = this.selectedSite.properties.siteInfo.parking.location!;
      loc.coordinates[1] = parseFloat(parts[0].toFixed(6));
      loc.coordinates[0] = parseFloat(parts[1].toFixed(6));
      const [lng, lat] = loc.coordinates;
      if (this._parkingMarker && this._parkingMap) {
        this._parkingMarker.setLngLat([lng, lat]).addTo(this._parkingMap);
        this._parkingMap.flyTo({ center: [lng, lat], zoom: 15 });
      }
      this._cdr.detectChanges();
    }
  }

  openParkingInGoogleMaps() {
    const loc = this.selectedSite.properties.siteInfo.parking.location!;
    const [lng, lat] = loc.coordinates;
    this._window!.open(`https://www.google.com/maps?q=${lat},${lng}`, '_blank', 'noopener,noreferrer');
  }

  setLng(v: string) {
    this.selectedSite.location.coordinates[0] = parseFloat(v) || 0;
    this._updateMarkerFromCoords();
  }

  setLat(v: string) {
    this.selectedSite.location.coordinates[1] = parseFloat(v) || 0;
    this._updateMarkerFromCoords();
  }

  private _geocodeTimer: ReturnType<typeof setTimeout> | null = null;

  private _updateMarkerFromCoords() {
    const [lng, lat] = this.selectedSite.location.coordinates;
    if ((lng || lat) && this._marker && this._map) {
      this._marker.setLngLat([lng, lat]);
      this._map.panTo([lng, lat]);
    }
    if (lng && lat) {
      if (this._geocodeTimer) clearTimeout(this._geocodeTimer);
      this._geocodeTimer = setTimeout(() => this._reverseGeocode(lng, lat), 800);
    }
  }

  private async _reverseGeocode(lng: number, lat: number) {
    try {
      const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json` +
        `?types=neighborhood,locality,place,district,region&country=gb&access_token=${mapboxToken}`;
      const res = await fetch(url);
      if (!res.ok) return;
      const data = await res.json();
      const ctx: Array<{ id: string; text: string }> = [
        ...(data.features?.[0]?.context ?? []),
        ...(data.features?.[0] ? [{ id: data.features[0].place_type?.[0] ?? '', text: data.features[0].text }] : []),
      ];
      const get = (prefix: string) => ctx.find(c => c.id.startsWith(prefix))?.text ?? '';
      const postalTown  = get('place');
      const nameLC = (this.selectedSite.properties.name ?? '').toLowerCase();
      const locality = [get('neighborhood'), get('locality'), postalTown]
        .find(v => v && v.toLowerCase() !== nameLC) ?? '';
      this.selectedSite.properties.location.locality    = locality;
      this.selectedSite.properties.location.postalTown  = postalTown;
      this.selectedSite.properties.location.county      = get('region');
      this.selectedSite.properties.location.adminLevel3 = get('district');
      this._cdr.detectChanges();
    } catch { /* silently ignore geocoding failures */ }
  }

  private _normaliseLinks(raw: any): string[] {
    if (!raw) return [];
    // If stored as a single stringified array e.g. '["https://...","https://..."]'
    if (typeof raw === 'string') {
      try { raw = JSON.parse(raw); } catch { raw = [raw]; }
    }
    if (!Array.isArray(raw)) return [];
    return raw
      .map((l: any) => String(l).replace(/^[\s["']+|[\s\]"']+$/g, '').trim())
      .filter((l: string) => l !== '');
  }

  safeUrl(url: string): SafeUrl {
    return this._sanitizer.bypassSecurityTrustUrl(url);
  }

  // ResearchNotes links
  addResearchLink() {
    let url = this._window?.prompt('Enter URL:')?.trim();
    if (!url) return;
    if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
    this.selectedSite.properties.researchNotes.links.push(url);
  }

  deleteResearchLink(index: number) {
    if (!this._window?.confirm('Delete this link?')) return;
    this.selectedSite.properties.researchNotes.links.splice(index, 1);
  }

  // moreInfo
  addMoreInfo() {
    this.selectedSite.properties.moreInfo.push({ title: '', icon: '', url: '', text: '', preferred: false });
  }

  deleteMoreInfo(index: number) {
    if (!this._window?.confirm('Delete this info link?')) return;
    this.selectedSite.properties.moreInfo.splice(index, 1);
  }

  // Parking location helpers
  getParkingLng(): number { return this.selectedSite.properties.siteInfo.parking.location?.coordinates[0] ?? 0; }
  getParkingLat(): number { return this.selectedSite.properties.siteInfo.parking.location?.coordinates[1] ?? 0; }

  setParkingCoords(type: 'lat' | 'lng', v: string) {
    const val = parseFloat(v) || 0;
    const loc = this.selectedSite.properties.siteInfo.parking.location;
    if (loc) {
      if (type === 'lng') loc.coordinates[0] = val;
      else loc.coordinates[1] = val;
    } else {
      this.selectedSite.properties.siteInfo.parking.location = {
        type: 'Point',
        coordinates: type === 'lng' ? [val, 0] : [0, val]
      };
    }
    this._updateParkingMarkerFromCoords();
  }

  private _updateParkingMarkerFromCoords() {
    const loc = this.selectedSite.properties.siteInfo.parking.location;
    if (!loc || !this._parkingMarker || !this._parkingMap) return;
    const [lng, lat] = loc.coordinates;
    if (lng || lat) {
      this._parkingMarker.setLngLat([lng, lat]);
      this._parkingMarker.addTo(this._parkingMap);
      this._parkingMap.panTo([lng, lat]);
    }
  }

  toggleParkingLocation(hasParkingCoords: boolean) {
    if (hasParkingCoords) {
      this.selectedSite.properties.siteInfo.parking.location = { type: 'Point', coordinates: [0, 0] };
      setTimeout(() => this._initParkingMap(), 0);
    } else {
      this._destroyParkingMap();
      this.selectedSite.properties.siteInfo.parking.location = null;
    }
  }

  async onSave() {
    try {
      const id = this.selectedSite._id;
      const result = await this._http.upsertSite(this.selectedSite);
      this.refreshSiteList(result);
      if (id) {
        this.selectedSite = this.sites.find(s => s._id === id) ?? this.sites[0];
      }
      this._window!.alert('Site saved successfully!');
    } catch (error: any) {
      console.error(error);
      this._window!.alert(`Save failed:\n${error?.error?.message || error}`);
    }
  }

  onYesDelete(areYouSure: boolean = false) {
    if (!areYouSure) {
      this.askForConfirmation = true;
    } else {
      this.askForConfirmation = false;
      this.doDelete();
    }
  }

  onNoDelete() {
    this.askForConfirmation = false;
  }

  async doDelete() {
    try {
      const result = await this._http.deleteSite(this.selectedSite._id);
      this.refreshSiteList(result);
      this._window!.alert('Site deleted.');
    } catch (error: any) {
      console.error(error);
      this._window!.alert(`Delete failed:\n${error?.error?.message || error}`);
    }
  }
}
