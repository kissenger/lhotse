import { Component, OnInit, AfterViewInit, ChangeDetectorRef, OnDestroy, Inject } from '@angular/core';
import { NgClass, DOCUMENT } from '@angular/common';
import { RouterLink, ActivatedRoute } from '@angular/router';
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
    FacebookSvgComponent, PhoneSvgComponent, CloseIconSvgComponent, LoaderComponent, NgClass, RouterLink ],
  selector: 'app-map',
  templateUrl: './map.component.html',
  styleUrls: ['./map.component.css'],
})

export class MapComponent implements OnInit, AfterViewInit, OnDestroy {

  public geoJson: any = null;
  public loadingState: 'loading' | 'failed' | 'success' = 'loading';
  public map?: MapService;
  public filterContext: { displayName: string; alsoKnownAs?: string[] } | null = null;
  public filterEmpty: boolean = false;
  private _selectionSub?: import('rxjs').Subscription;

  snorkellingSitesEnabled = true;
  otherSitesEnabled = true;
  snorkellingExpanded = false;
  otherExpanded = false;
  snorkellingCategories: { name: string; enabled: boolean }[] = [];
  otherCategories: { name: string; enabled: boolean }[] = [];

  get filteredSnorkelCount(): number {
    if (!this.geoJson) return 0;
    const enabledCats = new Set(this.snorkellingCategories.filter(c => c.enabled).map(c => c.name));
    return this.geoJson.features.filter((f: any) => {
      if (f.properties.featureType !== 'Snorkelling Site') return false;
      if (!this.snorkellingSitesEnabled) return false;
      const cats: string[] = f.properties.categories ?? [];
      if (cats.length === 0) return true;
      return cats.some((c: string) => enabledCats.has(c));
    }).length;
  }

  get filteredOrgCount(): number {
    if (!this.geoJson) return 0;
    const enabledCats = new Set(this.otherCategories.filter(c => c.enabled).map(c => c.name));
    return this.geoJson.features.filter((f: any) => {
      if (f.properties.featureType === 'Snorkelling Site') return false;
      if (!this.otherSitesEnabled) return false;
      const cats: string[] = f.properties.categories ?? [];
      if (cats.length === 0) return true;
      return cats.some((c: string) => enabledCats.has(c));
    }).length;
  }

  constructor(
    private _lazyServiceInjector: LazyServiceInjector,    
    private _http: HttpService,
    private _cdr: ChangeDetectorRef,
    private _route: ActivatedRoute,
    @Inject(DOCUMENT) private _document: Document
  ) {}

  ngOnInit() {
    const { county, nation } = this._resolveParams();
    if (county) {
      const displayName = this._countyDisplayAliases[county.toLowerCase()] ?? county.replace(/\b\w/g, c => c.toUpperCase());
      const alsoKnownAs = this._countyAltNames[county.toLowerCase()];
      this.filterContext = { displayName, alsoKnownAs };
    } else if (nation) {
      const displayName = this._nationDisplayNames[nation.toLowerCase()] ?? nation.replace(/\b\w/g, c => c.toUpperCase());
      this.filterContext = { displayName };
    }
  }

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
      this._applyQueryParams();
      this._cdr.detectChanges();

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

  private _buildCategoryLists(features?: any[]) {
    const snorkCats = new Set<string>();
    const otherCats = new Set<string>();
    for (const feature of (features ?? this.geoJson.features)) {
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
    const { county, nation } = this._resolveParams();
    const sitesWithin = params.get('sitesWithin');

    if (!siteName && !county && !nation) return;

    const includeProviders = params.get('includeProviders')?.toLowerCase() !== 'false';

    if (siteName) {
      const mapEl = this._document.getElementById('map');
      if (mapEl) {
        const win = this._document.defaultView;
        const headerHeight = parseInt(win?.getComputedStyle(this._document.documentElement).getPropertyValue('--header-height') ?? '75', 10) || 75;
        const top = mapEl.getBoundingClientRect().top + (win?.scrollY ?? 0) - headerHeight;
        win?.scrollTo({ top, behavior: 'smooth' });
      }
    }

    if (county) {
      const displayName = this._countyDisplayAliases[county.toLowerCase()] ?? county.replace(/\b\w/g, c => c.toUpperCase());
      const alsoKnownAs = this._countyAltNames[county.toLowerCase()];
      this.filterContext = { displayName, alsoKnownAs };
      const features = this._filterByCounty(county, includeProviders);
      this._buildCategoryLists(features);
      this.filterEmpty = features.length === 0;
      this.map.fitBoundsToFeatures(features);
    }

    if (nation) {
      const displayName = this._nationDisplayNames[nation.toLowerCase()] ?? nation.replace(/\b\w/g, c => c.toUpperCase());
      this.filterContext = { displayName };
      const features = this._filterByNation(nation, includeProviders);
      this._buildCategoryLists(features);
      this.filterEmpty = features.length === 0;
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

  // Resolves county/nation from the canonical params *and* common near-miss alternatives.
  // e.g. ?country=england is treated as ?nation=england
  private _resolveParams(): { county: string | null; nation: string | null } {
    const p = this._route.snapshot.queryParamMap;
    const county = p.get('county') ?? p.get('district');
    const nation = p.get('nation') ?? p.get('country') ?? p.get('region');
    return { county, nation };
  }

  private readonly _countyAltNames: Record<string, string[]> = {
    'isles of scilly': ['Scillies', 'Scilly Isles'],
    'cornwall': ['Scillies', 'Scilly Isles'],
    'highland': ['Scottish Highlands'],
    'highlands': ['Scottish Highlands'],
    'na h-eileanan siar': ['Outer Hebrides', 'Western Isles'],
    'outer hebrides': ['Outer Hebrides', 'Western Isles'],
    'western isles': ['Outer Hebrides', 'Western Isles'],
    'east riding of yorkshire': ['East Yorkshire'],
    'east yorkshire': ['East Yorkshire'],
    'isle of anglesey': ['Anglesey'],
    'anglesey': ['Anglesey'],
    'orkney islands': ['Orkney'],
    'orkney': ['Orkney'],
  };

  private readonly _countyDisplayAliases: Record<string, string> = {
    // special combined display names
    'cornwall': 'Cornwall & the Isles of Scilly',
    'highlands': 'The Highlands',
    // user-friendly slug aliases
    'orkney': 'Orkney Islands',
    'anglesey': 'Isle of Anglesey',
    'outer hebrides': 'Outer Hebrides',
    'western isles': 'Outer Hebrides',
    'east yorkshire': 'East Riding of Yorkshire',
    'east riding': 'East Riding of Yorkshire',
    // fix title-case for multi-word DB names used directly as URL params
    'argyll and bute': 'Argyll and Bute',
    'brighton and hove': 'Brighton and Hove',
    'east riding of yorkshire': 'East Riding of Yorkshire',
    'isle of anglesey': 'Isle of Anglesey',
    'isle of wight': 'Isle of Wight',
    'na h-eileanan siar': 'Na h-Eileanan Siar',
    'redcar and cleveland': 'Redcar and Cleveland',
  };

  private readonly _nationDisplayNames: Record<string, string> = {
    'england': 'England',
    'scotland': 'Scotland',
    'wales': 'Wales',
    'britain': 'Britain',
    'uk': 'the UK',
  };

  // Maps URL ?nation= values to the Mapbox `region` field values stored in the DB.
  // 'britain' and 'uk' show all sites (no filter).
  private readonly _nationRegionMap: Record<string, string | null> = {
    'england': 'england',
    'scotland': 'scotland',
    'wales': 'wales',
    'britain': null,
    'uk': null,
  };

  private _filterByNation(nation: string, includeProviders: boolean): any[] {
    const region = this._nationRegionMap[nation.toLowerCase()];
    const features = this.geoJson.features.filter((f: any) => {
      if (!includeProviders && f.properties.featureType !== 'Snorkelling Site') return false;
      if (region === null) return true; // britain / uk = all sites
      return (f.properties.location?.region as string)?.toLowerCase() === region;
    });
    this.map!.updateSourceData({ ...this.geoJson, features });
    return features;
  }

  private readonly _countyAliases: Record<string, string[]> = {
    'cornwall': ['isles of scilly'],
    'highlands': ['highland'],
    'orkney': ['orkney islands'],
    'anglesey': ['isle of anglesey'],
    'outer hebrides': ['na h-eileanan siar'],
    'western isles': ['na h-eileanan siar'],
    'east yorkshire': ['east riding of yorkshire'],
    'east riding': ['east riding of yorkshire'],
  };

  private _filterByCounty(county: string, includeProviders: boolean): any[] {
    const normalised = county.toLowerCase();
    const matches = new Set([normalised, ...(this._countyAliases[normalised] ?? [])]);
    const features = this.geoJson.features.filter(
      (f: any) => {
        const loc = f.properties.location;
        const district = (loc?.district as string)?.toLowerCase();
        const legacy = (loc?.adminLevel3 as string)?.toLowerCase();
        const match = (district && matches.has(district)) ||
          (!loc?.district && legacy && matches.has(legacy));
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
