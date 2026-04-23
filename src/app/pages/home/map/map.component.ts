import { Component, OnInit, AfterViewInit, ChangeDetectorRef, OnDestroy, Inject, PLATFORM_ID } from '@angular/core';
import { NgClass, DOCUMENT, Location, isPlatformBrowser } from '@angular/common';
import { RouterLink, ActivatedRoute } from '@angular/router';
import { HttpService } from '@shared/services/http.service';
import { MapService } from '@shared/services/map.service';
import {
  MAP_COUNTRY_DISPLAY_NAMES,
  MAP_COUNTRY_REGION_MAP,
  buildMapPath,
  buildMapPathForFeature,
  getCountrySlugFromRegion,
  getCountyAlsoKnownAs,
  getCountyDisplayName,
  getCountySlugFromLocation,
  getCountyMatchSlugs,
  normaliseCountrySegment,
  normaliseCountySegment,
  normaliseSiteSegment,
  slugifyMapSegment,
} from '@shared/map-paths';
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
  public selectedFeatureIndex: number | null = null;
  public filterContext: { displayName: string; alsoKnownAs?: string[] } | null = null;
  public siteContext: { displayName: string; countyDisplayName?: string; countryDisplayName?: string; parentPath: string } | null = null;
  public upLevelLink: { path: string; label: string } | null = null;
  public routeLevel: 'root' | 'country' | 'county' | 'site' = 'root';
  public filterEmpty: boolean = false;
  public routeScopedFeatures: any[] = [];
  private _selectionSub?: import('rxjs').Subscription;

  snorkellingSitesEnabled = true;
  otherSitesEnabled = true;
  snorkellingExpanded = false;
  otherExpanded = false;
  snorkellingCategories: { name: string; enabled: boolean }[] = [];
  otherCategories: { name: string; enabled: boolean }[] = [];
  private readonly _isBrowser: boolean;

  get selectedFeature(): any | null {
    if (!this.geoJson?.features) return null;
    const mapSelectionIndex = typeof this.map?.selectedSymbolId === 'number' ? this.map.selectedSymbolId : null;
    const featureIndex = mapSelectionIndex ?? this.selectedFeatureIndex;
    if (featureIndex == null || featureIndex < 0) return null;
    return this.geoJson.features[featureIndex] ?? null;
  }

  get currentFeature(): any | null {
    return this.selectedFeature?.properties ?? null;
  }

  get panelPositionClass(): 'left' | 'right' | 'none' {
    if (this.map) {
      const mapPosition = this.map.popupPosition;
      return mapPosition === 'left' || mapPosition === 'right' ? mapPosition : 'none';
    }

    return this.currentFeature ? 'right' : 'none';
  }

  get filteredSnorkelCount(): number {
    if (!this.geoJson) return 0;
    const enabledCats = new Set(this.snorkellingCategories.filter(c => c.enabled).map(c => c.name));
    return this._getFilterBaseFeatures().filter((f: any) => {
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
    return this._getFilterBaseFeatures().filter((f: any) => {
      if (f.properties.featureType === 'Snorkelling Site') return false;
      if (!this.otherSitesEnabled) return false;
      const cats: string[] = f.properties.categories ?? [];
      if (cats.length === 0) return true;
      return cats.some((c: string) => enabledCats.has(c));
    }).length;
  }

  get countyFeaturedLinks(): Array<{ name: string; path: string; locality?: string }> {
    if (!this.geoJson || this.routeLevel !== 'county') return [];
    const { county, country } = this._resolveParams();
    if (!county) return [];
    const matches = getCountyMatchSlugs(county);

    return this.geoJson.features
      .filter((f: any) => {
        if (f.properties.featureType !== 'Snorkelling Site') return false;
        const loc = f.properties.location;
        const featureCountySlugs = [loc?.county, loc?.district, loc?.adminLevel3]
          .filter((value: unknown): value is string => typeof value === 'string' && value.trim() !== '')
          .map((value: string) => slugifyMapSegment(value));
        return featureCountySlugs.some((value: string) => matches.has(value));
      })
      .slice(0, 10)
      .map((f: any) => ({
        name: f.properties.name as string,
        path: buildMapPath({ country, county, siteName: f.properties.name as string }),
        locality: f.properties.location?.locality as string | undefined,
      }));
  }

  get countryFeaturedLinks(): Array<{ name: string; path: string; county: string }> {
    if (!this.geoJson || this.routeLevel !== 'country') return [];
    const { country } = this._resolveParams();
    if (!country) return [];

    return this.geoJson.features
      .filter((f: any) => {
        if (f.properties.featureType !== 'Snorkelling Site') return false;
        return getCountrySlugFromRegion(f.properties.location?.region as string) === country;
      })
      .slice(0, 12)
      .map((f: any) => {
        const countySlug = getCountySlugFromLocation(f.properties.location);
        return {
          name: f.properties.name as string,
          path: buildMapPath({ country, county: countySlug, siteName: f.properties.name as string }),
          county: getCountyDisplayName(countySlug ?? ''),
        };
      });
  }

  get relatedCountySiteLinks(): Array<{ name: string; path: string }> {
    if (!this.geoJson || this.routeLevel !== 'site') return [];
    const selected = this.selectedFeature;
    if (!selected) return [];

    const countySlug = getCountySlugFromLocation(selected.properties.location);
    if (!countySlug) return [];
    const countrySlug = getCountrySlugFromRegion(selected.properties.location?.region as string);
    const currentName = selected.properties.name as string;

    return this.geoJson.features
      .filter((f: any) => f.properties.featureType === 'Snorkelling Site')
      .filter((f: any) => f.properties.name !== currentName)
      .filter((f: any) => getCountySlugFromLocation(f.properties.location) === countySlug)
      .slice(0, 8)
      .map((f: any) => ({
        name: f.properties.name as string,
        path: buildMapPath({ country: countrySlug, county: countySlug, siteName: f.properties.name as string }),
      }));
  }

  get relatedHabitatSiteLinks(): Array<{ name: string; path: string }> {
    if (!this.geoJson || this.routeLevel !== 'site') return [];
    const selected = this.selectedFeature;
    if (!selected) return [];

    const selectedCategories: string[] = selected.properties.categories ?? [];
    if (!selectedCategories.length) return [];
    const selectedSet = new Set(selectedCategories);
    const currentName = selected.properties.name as string;

    return this.geoJson.features
      .filter((f: any) => f.properties.featureType === 'Snorkelling Site')
      .filter((f: any) => f.properties.name !== currentName)
      .filter((f: any) => {
        const cats: string[] = f.properties.categories ?? [];
        return cats.some((cat: string) => selectedSet.has(cat));
      })
      .slice(0, 8)
      .map((f: any) => ({
        name: f.properties.name as string,
        path: buildMapPathForFeature(f.properties),
      }));
  }

  get relatedNearbySiteLinks(): Array<{ name: string; path: string; distanceLabel: string }> {
    if (!this.geoJson || this.routeLevel !== 'site') return [];
    const selected = this.selectedFeature;
    if (!selected) return [];

    const currentName = selected.properties.name as string;
    const [originLng, originLat] = selected.geometry.coordinates as [number, number];

    const nearby = this.geoJson.features
      .filter((f: any) => f.properties.featureType === 'Snorkelling Site')
      .filter((f: any) => f.properties.name !== currentName)
      .map((f: any) => {
        const [lng, lat] = f.geometry.coordinates as [number, number];
        return {
          name: f.properties.name as string,
          path: buildMapPathForFeature(f.properties),
          distanceKm: this._haversineKm(originLat, originLng, lat, lng),
        };
      })
      .sort((a: { distanceKm: number }, b: { distanceKm: number }) => a.distanceKm - b.distanceKm)
      .slice(0, 8);

    return nearby.map((item: { name: string; path: string; distanceKm: number }) => ({
        name: item.name,
        path: item.path,
        distanceLabel: `${item.distanceKm.toFixed(1)} km`,
      }));
  }

  get routeLastUpdatedLabel(): string | null {
    if (!this.geoJson?.features) return null;

    const getUpdatedAtMs = (feature: any): number | null => {
      const raw = feature?.properties?.updatedAt ?? feature?.updatedAt;
      if (!raw) return null;
      const date = new Date(raw);
      const time = date.getTime();
      return Number.isNaN(time) ? null : time;
    };

    const formatLabel = (ms: number | null): string | null => {
      if (ms == null) return null;
      return new Intl.DateTimeFormat('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      }).format(new Date(ms));
    };

    if (this.routeLevel === 'site') {
      return formatLabel(getUpdatedAtMs(this.selectedFeature));
    }

    const { country, county } = this._resolveParams();
    const filteredFeatures = this.geoJson.features.filter((feature: any) => {
      if (feature.properties?.featureType !== 'Snorkelling Site') return false;

      if (county) {
        const matches = getCountyMatchSlugs(county);
        const loc = feature.properties?.location;
        const featureCountySlugs = [loc?.county, loc?.district, loc?.adminLevel3]
          .filter((value: unknown): value is string => typeof value === 'string' && value.trim() !== '')
          .map((value: string) => slugifyMapSegment(value));
        return featureCountySlugs.some((value: string) => matches.has(value));
      }

      if (country) {
        return getCountrySlugFromRegion(feature.properties?.location?.region as string) === country;
      }

      return false;
    });

    const latestMs = filteredFeatures.reduce((latest: number | null, feature: any) => {
      const updatedAt = getUpdatedAtMs(feature);
      if (updatedAt == null) return latest;
      if (latest == null || updatedAt > latest) return updatedAt;
      return latest;
    }, null);

    return formatLabel(latestMs);
  }

  constructor(
    private _lazyServiceInjector: LazyServiceInjector,    
    private _http: HttpService,
    private _cdr: ChangeDetectorRef,
    private _route: ActivatedRoute,
    private _location: Location,
    @Inject(PLATFORM_ID) platformId: object,
    @Inject(DOCUMENT) private _document: Document
  ) {
    this._isBrowser = isPlatformBrowser(platformId);
  }

  ngOnInit() {
    const { county, country, site } = this._resolveParams();
    const countryDisplayName = country ? this._getCountryDisplayName(country) : undefined;
    const countyDisplayName = county ? getCountyDisplayName(county) : undefined;

    if (site) {
      this.routeLevel = 'site';
      this.siteContext = {
        displayName: this._formatSlugForDisplay(site),
        countyDisplayName,
        countryDisplayName,
        parentPath: buildMapPath({ country, county })
      };

      const parentLabel = countyDisplayName
        ? `See all sites in ${countyDisplayName}`
        : (countryDisplayName ? `See all sites in ${countryDisplayName}` : 'See all sites in Britain');
      this.upLevelLink = {
        path: buildMapPath({ country, county }),
        label: parentLabel
      };
    } else if (county) {
      this.routeLevel = 'county';
      const displayName = getCountyDisplayName(county);
      const alsoKnownAs = getCountyAlsoKnownAs(county);
      this.filterContext = { displayName, alsoKnownAs };
      this.upLevelLink = {
        path: buildMapPath({ country }),
        label: `See all sites in ${countryDisplayName ?? 'Britain'}`
      };
    } else if (country) {
      this.routeLevel = 'country';
      const displayName = MAP_COUNTRY_DISPLAY_NAMES[country] ?? country.replace(/\b\w/g, c => c.toUpperCase());
      this.filterContext = { displayName };
      this.upLevelLink = {
        path: '/map',
        label: 'See all sites in Britain'
      };
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
      this.routeScopedFeatures = [...(this.geoJson.features ?? [])];
      this._buildCategoryLists();

      if (this._isBrowser) {
        this.map = await this._lazyServiceInjector.get<MapService>(() =>
          import('@shared/services/map.service').then((m) => m.MapService)
        );
        this._injectMapboxCss();
        await this.map.create(this.geoJson);

        // React to selection changes coming from MapService (mapbox events)
        this._selectionSub = this.map.selectionChanged.subscribe(() => {
          this.selectedFeatureIndex = typeof this.map?.selectedSymbolId === 'number' ? this.map.selectedSymbolId : null;
          this._syncBrowserPath();
          this._cdr.detectChanges();
        });
      }
      this.loadingState = 'success';
      this._applyRouteState();
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

  scrollToMap(event?: Event) {
    event?.preventDefault();
    if (!this._isBrowser) return;

    const mapEl = this._document.getElementById('map');
    if (!mapEl) return;

    const win = this._document.defaultView;
    const headerHeight = parseInt(win?.getComputedStyle(this._document.documentElement).getPropertyValue('--header-height') ?? '75', 10) || 75;
    const top = mapEl.getBoundingClientRect().top + (win?.scrollY ?? 0) - headerHeight;
    win?.scrollTo({ top, behavior: 'smooth' });
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
    const baseFeatures = this._getFilterBaseFeatures();

    const allEnabled =
      this.snorkellingCategories.every(c => c.enabled) &&
      this.otherCategories.every(c => c.enabled);

    if (this.map.selectedFeature) this.map.clearSelection();

    if (allEnabled) {
      this.map.updateSourceData({ ...this.geoJson, features: baseFeatures });
      return;
    }

    const enabledSnorkCats = new Set(this.snorkellingCategories.filter(c => c.enabled).map(c => c.name));
    const enabledOtherCats = new Set(this.otherCategories.filter(c => c.enabled).map(c => c.name));

    const filtered = {
      ...this.geoJson,
      features: baseFeatures.filter((f: any) => {
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

  private _applyRouteState() {
    if (!this.geoJson) return;
    const queryParams = this._route.snapshot.queryParamMap;
    const { country, county, site } = this._resolveParams();
    const sitesWithin = queryParams.get('sitesWithin');

    if (!site && !county && !country) return;

    const includeProviders = queryParams.get('includeProviders')?.toLowerCase() !== 'false';

    if (site && this._isBrowser) {
      const mapEl = this._document.getElementById('map');
      if (mapEl) {
        const win = this._document.defaultView;
        const headerHeight = parseInt(win?.getComputedStyle(this._document.documentElement).getPropertyValue('--header-height') ?? '75', 10) || 75;
        const top = mapEl.getBoundingClientRect().top + (win?.scrollY ?? 0) - headerHeight;
        win?.scrollTo({ top, behavior: 'smooth' });
      }
    }

    if (county) {
      const displayName = getCountyDisplayName(county);
      const alsoKnownAs = getCountyAlsoKnownAs(county);
      this.filterContext = { displayName, alsoKnownAs };
      const features = this._filterByCounty(county, includeProviders);
      this.routeScopedFeatures = features;
      this._buildCategoryLists(features);
      this.filterEmpty = features.length === 0;
      if (this.map) this.map.fitBoundsToFeatures(features);
    } else if (country) {
      const displayName = MAP_COUNTRY_DISPLAY_NAMES[country] ?? country.replace(/\b\w/g, c => c.toUpperCase());
      this.filterContext = { displayName };
      const features = this._filterByNation(country, includeProviders);
      this.routeScopedFeatures = features;
      this._buildCategoryLists(features);
      this.filterEmpty = features.length === 0;
      if (this.map) this.map.fitBoundsToFeatures(features);
    } else {
      this.routeScopedFeatures = [...(this.geoJson.features ?? [])];
    }

    if (site) {
      const idx = this._findFeatureIndex(site);
      if (idx < 0) return;
      this.selectedFeatureIndex = idx;
      const coords = this.geoJson.features[idx].geometry.coordinates as [number, number];
      if (sitesWithin && this.map) {
        const km = parseFloat(sitesWithin.replace(/[^0-9.]/g, ''));
        if (km > 0) {
          const features = this._filterByRadius(idx, coords, km, includeProviders);
          this.routeScopedFeatures = features;
          this.map.fitBoundsToFeatures(features);
          return;
        }
      }
      if (this.map) this.map.flyToAndSelect(idx, coords, 15);
    }
  }

  private _getFilterBaseFeatures(): any[] {
    if (!this.geoJson?.features) return [];
    return this.routeScopedFeatures.length ? this.routeScopedFeatures : this.geoJson.features;
  }

  private _findFeatureIndex(siteSlug: string): number {
    return this.geoJson.features.findIndex(
      (f: any) => f.properties.featureType === 'Snorkelling Site'
        && slugifyMapSegment(f.properties.name as string) === siteSlug
    );
  }

  // Resolves path params first, then falls back to the legacy query-param scheme.
  private _resolveParams(): { county: string | null; country: string | null; site: string | null } {
    const paramMap = this._route.snapshot.paramMap;
    const queryMap = this._route.snapshot.queryParamMap;
    const county = normaliseCountySegment(paramMap.get('county'))
      ?? normaliseCountySegment(queryMap.get('county') ?? queryMap.get('district'));
    const country = normaliseCountrySegment(paramMap.get('country'))
      ?? normaliseCountrySegment(queryMap.get('nation') ?? queryMap.get('country') ?? queryMap.get('region'));
    const site = normaliseSiteSegment(paramMap.get('siteName'));
    return { county, country, site };
  }

  private _filterByNation(country: string, includeProviders: boolean): any[] {
    const region = MAP_COUNTRY_REGION_MAP[country];
    const features = this.geoJson.features.filter((f: any) => {
      if (!includeProviders && f.properties.featureType !== 'Snorkelling Site') return false;
      if (region === null) return true; // britain / uk = all sites
      return slugifyMapSegment(f.properties.location?.region as string) === region;
    });
    this.map?.updateSourceData({ ...this.geoJson, features });
    return features;
  }

  private _filterByCounty(county: string, includeProviders: boolean): any[] {
    const matches = getCountyMatchSlugs(county);
    const features = this.geoJson.features.filter(
      (f: any) => {
        const loc = f.properties.location;
        const featureCountySlugs = [loc?.county, loc?.district, loc?.adminLevel3]
          .filter((value: unknown): value is string => typeof value === 'string' && value.trim() !== '')
          .map((value: string) => slugifyMapSegment(value));
        const match = featureCountySlugs.some((value: string) => matches.has(value));
        return match && (includeProviders || f.properties.featureType === 'Snorkelling Site');
      }
    );
    this.map?.updateSourceData({ ...this.geoJson, features });
    return features;
  }

  closePanel() {
    if (this.map?.selectedFeature) {
      this.map.deselectSymbol();
      return;
    }

    this.selectedFeatureIndex = null;
    this._syncBrowserPath();
    this._cdr.detectChanges();
  }

  private _syncBrowserPath() {
    const includeProviders = this._route.snapshot.queryParamMap.get('includeProviders');
    const query = includeProviders && includeProviders.toLowerCase() === 'false'
      ? `includeProviders=${encodeURIComponent(includeProviders)}`
      : undefined;
    const currentSite = normaliseSiteSegment(this._route.snapshot.paramMap.get('siteName'));

    if (typeof this.map?.selectedSymbolId === 'number') {
      const selected = this.geoJson?.features?.[this.map.selectedSymbolId]?.properties;
      if (selected) {
        this._location.replaceState(buildMapPathForFeature(selected), query);
      }
      return;
    }

    if (typeof this.selectedFeatureIndex === 'number') {
      const selected = this.geoJson?.features?.[this.selectedFeatureIndex]?.properties;
      if (selected) {
        this._location.replaceState(buildMapPathForFeature(selected), query);
      }
      return;
    }

    // On explicit site routes, closing the popover should not change the route.
    if (currentSite) {
      return;
    }

    const { country, county } = this._resolveParams();
    this._location.replaceState(buildMapPath({ country, county }), query);
  }

  private _filterByRadius(originIdx: number, originCoords: [number, number], radiusKm: number, includeProviders: boolean): any[] {
    const [originLng, originLat] = originCoords;
    const features = this.geoJson.features.filter((f: any, i: number) => {
      if (i === originIdx) return true;
      if (!includeProviders && f.properties.featureType !== 'Snorkelling Site') return false;
      const [lng, lat] = f.geometry.coordinates;
      return this._haversineKm(originLat, originLng, lat, lng) <= radiusKm;
    });
    this.map?.updateSourceData({ ...this.geoJson, features });
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

  private _formatSlugForDisplay(value: string): string {
    return value
      .replace(/-/g, ' ')
      .replace(/\b\w/g, (char) => char.toUpperCase());
  }

  private _getCountryDisplayName(country: string): string {
    return MAP_COUNTRY_DISPLAY_NAMES[country] ?? this._formatSlugForDisplay(country);
  }

  
}
