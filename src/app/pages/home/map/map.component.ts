import { Component, AfterViewInit, ChangeDetectorRef, OnDestroy, Inject } from '@angular/core';
import { NgClass, DOCUMENT } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { HttpService } from '@shared/services/http.service';
import { MapService } from '@shared/services/map.service';
import { EmailSvgComponent } from '@shared/svg/email/email.component';
import { InstagramSvgComponent } from '@shared/svg/instagram/instagram.component';
import { YoutubeSvgComponent } from '@shared/svg/youtube/youtube.component';
import { LoaderComponent } from '@shared/components/loader/loader.component';
import { LazyServiceInjector } from '@shared/services/lazyloader.service';
import { environment } from '@environments/environment';
import { WebsiteSvgComponent } from '@shared/svg/website/website.component';
import { PhoneSvgComponent } from '@shared/svg/phone/phone.component';
import { FacebookSvgComponent } from '@shared/svg/facebook/facebook.component';
import { CloseIconSvgComponent } from '@shared/svg/closeIcon/closeIcon.component';

@Component({
  standalone: true,
  imports: [YoutubeSvgComponent, InstagramSvgComponent, EmailSvgComponent, WebsiteSvgComponent, 
    FacebookSvgComponent, PhoneSvgComponent, CloseIconSvgComponent, LoaderComponent, NgClass ],
  selector: 'app-map',
  templateUrl: './map.component.html',
  styleUrls: ['./map.component.css'],
})

export class MapComponent implements AfterViewInit, OnDestroy {

  public geoJson: any = null;
  public loadingState: 'loading' | 'failed' | 'success' = 'loading';
  public map?: MapService;
  private _selectionSub?: import('rxjs').Subscription;

  snorkellingSitesEnabled = true;
  otherSitesEnabled = true;
  snorkellingExpanded = false;
  otherExpanded = false;
  snorkellingCategories: { name: string; enabled: boolean }[] = [];
  otherCategories: { name: string; enabled: boolean }[] = [];

  constructor(
    private _lazyServiceInjector: LazyServiceInjector,    
    private _http: HttpService,
    private _cdr: ChangeDetectorRef,
    private _route: ActivatedRoute,
    @Inject(DOCUMENT) private _document: Document
  ) {}

  async ngAfterViewInit() {
  
    try {
      const visibility = environment.STAGE === 'prod' ? ['Production'] : ['Production', 'Development']
      const result = await Promise.race([
        this._http.getSites(visibility),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), 15000))
      ]);
      this.geoJson = result;
      this.map = await this._lazyServiceInjector.get<MapService>(() =>
        import('@shared/services/map.service').then((m) => m.MapService)
      );
      this._injectMapboxCss();
      await this.map.create(this.geoJson);
      this._buildCategoryLists();

      // React to selection changes coming from MapService (mapbox events)
      this._selectionSub = this.map.selectionChanged.subscribe(() => {
        this._cdr.detectChanges();
      });
      this.loadingState = 'success';
      this._cdr.detectChanges();
      this._applyQueryParams();

    } catch (error) {
      this.loadingState = 'failed';
      this._cdr.detectChanges();
    }
  }

  ngOnDestroy() {
    this._selectionSub?.unsubscribe();
  }

  private _injectMapboxCss() {
    const id = 'mapbox-gl-css';
    if (this._document.getElementById(id)) return;
    const link = this._document.createElement('link');
    link.id = id;
    link.rel = 'stylesheet';
    link.href = 'https://api.mapbox.com/mapbox-gl-js/v3.15.0/mapbox-gl.css';
    this._document.head.appendChild(link);
  }

  async onRetry() {
    this.loadingState = 'loading';
    this._cdr.detectChanges();
    await this.ngAfterViewInit();
  }

  private _buildCategoryLists() {
    const snorkCats = new Set<string>();
    const otherCats = new Set<string>();
    for (const feature of this.geoJson.features) {
      const props = feature.properties;
      const cats: string[] = props.categories ?? [];
      const isSnorkelling = props.featureType === 'Snorkelling Site';
      for (const c of cats) {
        (isSnorkelling ? snorkCats : otherCats).add(c);
      }
    }
    this.snorkellingCategories = [...snorkCats].sort().map(name => ({ name, enabled: true }));
    this.otherCategories = [...otherCats].sort().map(name => ({ name, enabled: true }));
  }

  toggleGroup(group: 'snorkelling' | 'other') {
    if (group === 'snorkelling') {
      this.snorkellingSitesEnabled = !this.snorkellingSitesEnabled;
      this.snorkellingCategories.forEach(c => c.enabled = this.snorkellingSitesEnabled);
    } else {
      this.otherSitesEnabled = !this.otherSitesEnabled;
      this.otherCategories.forEach(c => c.enabled = this.otherSitesEnabled);
    }
    this._applyFilter();
  }

  toggleCategory(cat: { name: string; enabled: boolean }, group: 'snorkelling' | 'other') {
    cat.enabled = !cat.enabled;
    const cats = group === 'snorkelling' ? this.snorkellingCategories : this.otherCategories;
    const anyEnabled = cats.some(c => c.enabled);
    if (group === 'snorkelling') this.snorkellingSitesEnabled = anyEnabled;
    else this.otherSitesEnabled = anyEnabled;
    this._applyFilter();
  }


  private _applyFilter() {
    if (!this.map || !this.geoJson) return;

    const allEnabled =
      this.snorkellingCategories.every(c => c.enabled) &&
      this.otherCategories.every(c => c.enabled);

    if (this.map.selectedFeature) this.map.clearSelection();

    if (allEnabled) {
      this.map.updateSourceData(this.geoJson);
      return;
    }

    const enabledSnorkCats = new Set(this.snorkellingCategories.filter(c => c.enabled).map(c => c.name));
    const enabledOtherCats = new Set(this.otherCategories.filter(c => c.enabled).map(c => c.name));

    const filtered = {
      ...this.geoJson,
      features: this.geoJson.features.filter((f: any) => {
        const isSnorkelling = f.properties.featureType === 'Snorkelling Site';
        const groupEnabled = isSnorkelling ? this.snorkellingSitesEnabled : this.otherSitesEnabled;
        if (!groupEnabled) return false;
        const cats: string[] = f.properties.categories ?? [];
        if (cats.length === 0) return true;
        const enabledCats = isSnorkelling ? enabledSnorkCats : enabledOtherCats;
        return cats.some((c: string) => enabledCats.has(c));
      }),
    };

    this.map.updateSourceData(filtered);
  }

  private _applyQueryParams() {
    if (!this.map || !this.geoJson) return;
    const params = this._route.snapshot.queryParamMap;
    const siteName = params.get('site');
    const county = params.get('county');
    const sitesWithin = params.get('sitesWithin');

    if (!siteName && !county) return;

    const includeProviders = params.get('includeProviders')?.toLowerCase() !== 'false';

    this._document.getElementById('map')?.scrollIntoView({ behavior: 'smooth', block: 'start' });

    if (county) {
      const features = this._filterByCounty(county, includeProviders);
      this.map.fitBoundsToFeatures(features);
    }

    if (siteName) {
      const idx = this._findFeatureIndex(siteName);
      if (idx < 0) return;
      const coords = this.geoJson.features[idx].geometry.coordinates as [number, number];
      if (sitesWithin) {
        const km = parseFloat(sitesWithin.replace(/[^0-9.]/g, ''));
        if (km > 0) {
          const features = this._filterByRadius(idx, coords, km, includeProviders);
          this.map.fitBoundsToFeatures(features);
          return;
        }
      }
      this.map.flyToAndSelect(idx, coords);
    }
  }

  private _findFeatureIndex(name: string): number {
    const normalised = name.toLowerCase();
    return this.geoJson.features.findIndex(
      (f: any) => (f.properties.name as string)?.toLowerCase() === normalised
    );
  }

  private _filterByCounty(county: string, includeProviders: boolean): any[] {
    const normalised = county.toLowerCase();
    const features = this.geoJson.features.filter(
      (f: any) => {
        const loc = f.properties.location;
        const match = (loc?.county as string)?.toLowerCase() === normalised ||
          (!loc?.county && (loc?.adminLevel3 as string)?.toLowerCase() === normalised);
        return match && (includeProviders || f.properties.featureType === 'Snorkelling Site');
      }
    );
    this.map!.updateSourceData({ ...this.geoJson, features });
    return features;
  }

  private _filterByRadius(originIdx: number, originCoords: [number, number], radiusKm: number, includeProviders: boolean): any[] {
    const [originLng, originLat] = originCoords;
    const features = this.geoJson.features.filter((f: any, i: number) => {
      if (i === originIdx) return true;
      if (!includeProviders && f.properties.featureType !== 'Snorkelling Site') return false;
      const [lng, lat] = f.geometry.coordinates;
      return this._haversineKm(originLat, originLng, lat, lng) <= radiusKm;
    });
    this.map!.updateSourceData({ ...this.geoJson, features });
    return features;
  }

  private _haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  
}
