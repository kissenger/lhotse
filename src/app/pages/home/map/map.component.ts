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
import { MAPBOX_CSS_URL } from '@shared/globals';
import { WebsiteSvgComponent } from '@shared/svg/website/website.component';
import { PhoneSvgComponent } from '@shared/svg/phone/phone.component';
import { FacebookSvgComponent } from '@shared/svg/facebook/facebook.component';
import { CloseIconSvgComponent } from '@shared/svg/closeIcon/closeIcon.component';
import { HtmlerPipe } from '@shared/pipes/htmler.pipe';
import { SanitizerPipe } from '@shared/pipes/sanitizer.pipe';

@Component({
  standalone: true,
  providers: [HtmlerPipe],
  imports: [YoutubeSvgComponent, InstagramSvgComponent, EmailSvgComponent, WebsiteSvgComponent, 
    FacebookSvgComponent, PhoneSvgComponent, CloseIconSvgComponent, LoaderComponent, NgClass, RouterLink,
    SanitizerPipe ],
  selector: 'app-map',
  templateUrl: './map.component.html',
  styleUrls: ['./map.component.css'],
})

export class MapComponent implements OnInit, AfterViewInit, OnDestroy {

  public geoJson: any = null;
  public loadingState: 'loading' | 'failed' | 'success' = 'loading';
  public sitesLoaded: boolean = false;
  public descriptionsLoaded: boolean = false;
  public isBrowser: boolean = false;
  public map?: MapService;
  public selectedFeatureIndex: number | null = null;
  public filterContext: { displayName: string; alsoKnownAs?: string[] } | null = null;
  public countyDescription: string = '';
  public countyDescriptionHtml: string = '';
  public countryDescription: string = '';
  public countryDescriptionHtml: string = '';
  public siteContext: { displayName: string; countyDisplayName?: string; countryDisplayName?: string; parentPath: string } | null = null;
  public organisationContext: { displayName: string; countyDisplayName?: string; countryDisplayName?: string; parentPath: string } | null = null;
  public upLevelLink: { path: string; label: string } | null = null;
  public routeLevel: 'root' | 'country' | 'county' | 'site' | 'organisation' = 'root';
  public filterEmpty: boolean = false;
  public routeScopedFeatures: any[] = [];
  public panelTopPx: number | null = 16;
  private _panelSide: 'left' | 'right' | 'none' = 'none';
  private _panelRecomputeTimer: ReturnType<typeof setTimeout> | null = null;
  private _resizeHandler?: () => void;
  private _selectionSub?: import('rxjs').Subscription;
  private _viewportSub?: import('rxjs').Subscription;

  get breadcrumbLinks(): Array<{ label: string; path: string }> {
    const { country, county, site } = this._resolveParams();
    const links: Array<{ label: string; path: string }> = [
      { label: 'Britain', path: '/map' }
    ];

    if (country) {
      links.push({
        label: this._getCountryDisplayName(country),
        path: buildMapPath({ country })
      });
    }

    if (county) {
      links.push({
        label: getCountyDisplayName(county),
        path: buildMapPath({ country, county })
      });
    }

    if (site) {
      links.push({
        label: this._formatSlugForDisplay(site),
        path: buildMapPath({ country, county, siteName: site })
      });
    }

    return links;
  }

  get pageLoaderState(): 'loading' | 'failed' {
    return this.loadingState === 'failed' ? 'failed' : 'loading';
  }

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
    return this._panelSide;
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

  get countySiteLinks(): Array<{ name: string; path: string }> {
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
      .sort((a: any, b: any) => (a.properties.name as string).localeCompare(b.properties.name as string))
      .slice(0, 12)
      .map((f: any) => ({
        name: f.properties.name as string,
        path: buildMapPath({ country, county, siteName: f.properties.name as string }),
      }));
  }

  get countryFeaturedLinks(): Array<{ name: string; path: string; county: string }> {
    if (!this.geoJson || this.routeLevel !== 'country') return [];
    const { country } = this._resolveParams();
    if (!country) return [];

    const rankFor = (siteName: string): number => {
      const key = `${country}:${siteName}`;
      let hash = 2166136261;
      for (let i = 0; i < key.length; i++) {
        hash ^= key.charCodeAt(i);
        hash = Math.imul(hash, 16777619);
      }
      return hash >>> 0;
    };

    return this.geoJson.features
      .filter((f: any) => {
        if (f.properties.featureType !== 'Snorkelling Site') return false;
        return getCountrySlugFromRegion(f.properties.location?.region as string) === country;
      })
      .sort((a: any, b: any) => rankFor(a.properties.name as string) - rankFor(b.properties.name as string))
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

  get countryCountyLinks(): Array<{ name: string; path: string }> {
    if (!this.geoJson || this.routeLevel !== 'country') return [];
    const { country } = this._resolveParams();
    if (!country) return [];

    const countiesBySlug = new Map<string, string>();

    for (const feature of this.geoJson.features) {
      if (feature?.properties?.featureType !== 'Snorkelling Site') continue;
      if (getCountrySlugFromRegion(feature.properties?.location?.region as string) !== country) continue;

      const countySlug = getCountySlugFromLocation(feature.properties?.location);
      if (!countySlug) continue;
      if (countySlug === 'isles-of-scilly') continue; // Skip, only show as part of Cornwall
      if (!countiesBySlug.has(countySlug)) {
        countiesBySlug.set(countySlug, getCountyDisplayName(countySlug));
      }
    }

    return [...countiesBySlug.entries()]
      .sort((a, b) => a[1].localeCompare(b[1]))
      .slice(0, 12)
      .map(([countySlug, displayName]) => ({
        name: displayName,
        path: buildMapPath({ country, county: countySlug }),
      }));
  }

  get rootCountryLinks(): Array<{ name: string; path: string }> {
    const countrySlugs: Array<'england' | 'scotland' | 'wales'> = ['england', 'scotland', 'wales'];
    return countrySlugs.map((countrySlug) => ({
      name: this._getCountryDisplayName(countrySlug),
      path: buildMapPath({ country: countrySlug }),
    }));
  }

  get nearestPublishedSiteLinks(): Array<{ name: string; displayName: string; path: string; isSnorkellingSite: boolean; distanceLabel: string }> {
    if (!this.geoJson || this.routeLevel !== 'site') return [];
    const selected = this._getSiteContextFeature();
    if (!selected) return [];

    const [originLng, originLat] = selected.geometry.coordinates as [number, number];
    const isNarrow = this._isBrowser && (this._document.defaultView?.innerWidth ?? 1024) < 768;
    const maxNearby = isNarrow ? 5 : 8;

    return this.geoJson.features
      .filter((f: any) => f !== selected)
      .filter((f: any) => !f.showOnMap || f.showOnMap === 'Production')
      .filter((f: any) => Array.isArray(f?.geometry?.coordinates) && f.geometry.coordinates.length >= 2)
      .map((f: any) => {
        const [lng, lat] = f.geometry.coordinates as [number, number];
        return {
          name: f.properties.name as string,
          path: buildMapPathForFeature(f.properties),
          isSnorkellingSite: f.properties.featureType === 'Snorkelling Site',
          distanceKm: this._haversineKm(originLat, originLng, lat, lng),
        };
      })
      .sort((a: { distanceKm: number }, b: { distanceKm: number }) => a.distanceKm - b.distanceKm)
      .slice(0, maxNearby)
      .map((item: { name: string; path: string; isSnorkellingSite: boolean; distanceKm: number }) => ({
        name: item.name,
        displayName: this._abbreviateNearbySiteName(item.name),
        path: item.path,
        isSnorkellingSite: item.isSnorkellingSite,
        distanceLabel: `${item.distanceKm.toFixed(1)} km`,
      }));
  }

  get nearestPublishedOrganisationLinks(): Array<{ name: string; displayName: string; path: string; isSnorkellingSite: boolean; distanceLabel: string }> {
    if (!this.geoJson || this.routeLevel !== 'organisation') return [];
    const selected = this._getOrganisationContextFeature();
    if (!selected) return [];

    const [originLng, originLat] = selected.geometry.coordinates as [number, number];
    const isNarrow = this._isBrowser && (this._document.defaultView?.innerWidth ?? 1024) < 768;
    const maxNearby = isNarrow ? 5 : 8;

    return this.geoJson.features
      .filter((f: any) => f !== selected)
      .filter((f: any) => !f.showOnMap || f.showOnMap === 'Production')
      .filter((f: any) => Array.isArray(f?.geometry?.coordinates) && f.geometry.coordinates.length >= 2)
      .map((f: any) => {
        const [lng, lat] = f.geometry.coordinates as [number, number];
        return {
          name: f.properties.name as string,
          path: buildMapPathForFeature(f.properties),
          isSnorkellingSite: f.properties.featureType === 'Snorkelling Site',
          distanceKm: this._haversineKm(originLat, originLng, lat, lng),
        };
      })
      .sort((a: { distanceKm: number }, b: { distanceKm: number }) => a.distanceKm - b.distanceKm)
      .slice(0, maxNearby)
      .map((item: { name: string; path: string; isSnorkellingSite: boolean; distanceKm: number }) => ({
        name: item.name,
        displayName: this._abbreviateNearbySiteName(item.name),
        path: item.path,
        isSnorkellingSite: item.isSnorkellingSite,
        distanceLabel: `${item.distanceKm.toFixed(1)} km`,
      }));
  }

  constructor(
    private _lazyServiceInjector: LazyServiceInjector,    
    private _http: HttpService,
    private _htmler: HtmlerPipe,
    private _cdr: ChangeDetectorRef,
    private _route: ActivatedRoute,
    private _location: Location,
    @Inject(PLATFORM_ID) platformId: object,
    @Inject(DOCUMENT) private _document: Document
  ) {
    this._isBrowser = isPlatformBrowser(platformId);
    this.isBrowser = this._isBrowser;
  }

  ngOnInit() {
    const { county, country, site } = this._resolveParams();
    const countryDisplayName = country ? this._getCountryDisplayName(country) : undefined;
    const countyDisplayName = county ? getCountyDisplayName(county) : undefined;

    if (site) {
      this.routeLevel = 'site';
      this.descriptionsLoaded = true;
      this.siteContext = {
        displayName: this._formatSlugForDisplay(site),
        countyDisplayName,
        countryDisplayName,
        parentPath: buildMapPath({ country, county })
      };
    } else if (county) {
      this.routeLevel = 'county';
      this.descriptionsLoaded = false;
      void this._loadCountyDescription(county);
      const displayName = getCountyDisplayName(county);
      const alsoKnownAs = getCountyAlsoKnownAs(county);
      this.filterContext = { displayName, alsoKnownAs };
    } else if (country) {
      this.routeLevel = 'country';
      this.descriptionsLoaded = false;
      void this._loadCountryDescription(country);
      const displayName = MAP_COUNTRY_DISPLAY_NAMES[country] ?? country.replace(/\b\w/g, c => c.toUpperCase());
      this.filterContext = { displayName };
    } else {
      this.routeLevel = 'root';
      this.descriptionsLoaded = false;
      void this._loadCountryDescription('britain');
    }
  }

  async ngAfterViewInit() {
    if (!this._isBrowser) {
      // Avoid blocking SSR on API fetch/timeout; map data is loaded on the client.
      this.loadingState = 'success';
      this._cdr.detectChanges();
      return;
    }
  
    try {
      const visibility = environment.STAGE === 'prod' ? ['Production'] : ['Production', 'Development']
      const result = await Promise.race([
        this._http.getSites(visibility),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), 15000))
      ]);
      
      // getSites already includes organisations merged in
      this.geoJson = result as any;
      this.routeScopedFeatures = [...(this.geoJson.features ?? [])];
      this._buildCategoryLists();
      this.sitesLoaded = true;
      this._cdr.detectChanges();

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
          this._schedulePanelPlacementRecompute();
        });

        this._viewportSub = this.map.viewportChanged.subscribe(() => {
          this._schedulePanelPlacementRecompute();
        });
      }
      this.loadingState = 'success';
      this._applyRouteState();
      this._cdr.detectChanges();
      this._schedulePanelPlacementRecompute();

      this._resizeHandler = () => this._schedulePanelPlacementRecompute();
      this._document.defaultView?.addEventListener('resize', this._resizeHandler);

    } catch (error) {
      this.loadingState = 'failed';
      this._cdr.detectChanges();
    }
  }

  ngOnDestroy() {
    this._selectionSub?.unsubscribe();
    this._viewportSub?.unsubscribe();
    if (this._panelRecomputeTimer) {
      clearTimeout(this._panelRecomputeTimer);
      this._panelRecomputeTimer = null;
    }
    if (this._resizeHandler) {
      this._document.defaultView?.removeEventListener('resize', this._resizeHandler);
      this._resizeHandler = undefined;
    }
  }

  private _schedulePanelPlacementRecompute() {
    if (!this._isBrowser) return;
    if (this._panelRecomputeTimer) clearTimeout(this._panelRecomputeTimer);
    this._panelRecomputeTimer = setTimeout(() => {
      this._panelRecomputeTimer = null;
      this._recomputePanelPlacement();
      this._cdr.detectChanges();
    }, 0);
  }

  private _recomputePanelPlacement() {
    if (!this.currentFeature || !this.map || !this.selectedFeature) {
      this._panelSide = 'none';
      this.panelTopPx = null;
      return;
    }

    const win = this._document.defaultView;
    if (!win) return;

    // Keep existing mobile bottom-sheet behavior.
    if (win.innerWidth < 768) {
      this._panelSide = 'right';
      this.panelTopPx = null;
      return;
    }

    const mapEl = this._document.getElementById('map');
    if (!mapEl) return;
    const containerRect = mapEl.getBoundingClientRect();

    const coords = this.selectedFeature.geometry?.coordinates as [number, number] | undefined;
    const screenPoint = coords ? this.map.projectToScreen(coords) : null;
    if (!screenPoint) {
      this._panelSide = 'right';
      this.panelTopPx = 16;
      return;
    }

    const panelWidth = 300;
    const panelHeight = 360;
    const horizontalInset = 16;
    const verticalInset = 16;

    const toLocalRect = (el: Element | null): { left: number; top: number; right: number; bottom: number } | null => {
      if (!(el instanceof HTMLElement)) return null;
      const style = win.getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden') return null;
      const r = el.getBoundingClientRect();
      return {
        left: r.left - containerRect.left,
        top: r.top - containerRect.top,
        right: r.right - containerRect.left,
        bottom: r.bottom - containerRect.top,
      };
    };

    const obstacles = [
      toLocalRect(this._document.querySelector('.map-container .filter-dropdown')),
      toLocalRect(this._document.querySelector('.map-container .mapboxgl-ctrl-top-right')),
    ].filter((r): r is { left: number; top: number; right: number; bottom: number } => !!r);

    const rectsIntersect = (
      a: { left: number; top: number; right: number; bottom: number },
      b: { left: number; top: number; right: number; bottom: number }
    ): boolean => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;

    const overlapArea = (
      a: { left: number; top: number; right: number; bottom: number },
      b: { left: number; top: number; right: number; bottom: number }
    ): number => {
      const x = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left));
      const y = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
      return x * y;
    };

    const scoreCandidate = (side: 'left' | 'right'): { score: number; top: number } => {
      const left = side === 'left'
        ? horizontalInset
        : Math.max(horizontalInset, containerRect.width - panelWidth - horizontalInset);

      let top = verticalInset;

      // If candidate intersects top controls/filter, move panel below the lowest conflicting obstacle.
      const testRect = { left, top, right: left + panelWidth, bottom: top + panelHeight };
      const blockers = obstacles.filter((o) => rectsIntersect(testRect, o));
      if (blockers.length) {
        const bottom = blockers.reduce((max, o) => Math.max(max, o.bottom), 0);
        top = bottom + 8;
      }

      const maxTop = Math.max(verticalInset, containerRect.height - panelHeight - verticalInset);
      top = Math.min(Math.max(top, verticalInset), maxTop);

      const panelRect = { left, top, right: left + panelWidth, bottom: top + panelHeight };
      let score = 0;

      for (const obstacle of obstacles) {
        score += overlapArea(panelRect, obstacle) * 10;
      }

      // Hard-penalize covering the selected symbol.
      const pointInside = screenPoint.x >= panelRect.left && screenPoint.x <= panelRect.right
        && screenPoint.y >= panelRect.top && screenPoint.y <= panelRect.bottom;
      if (pointInside) score += 1_000_000;

      // Mildly prefer not to drift down unless needed.
      score += top;

      return { score, top };
    };

    const leftCandidate = scoreCandidate('left');
    const rightCandidate = scoreCandidate('right');
    const bestSide = leftCandidate.score <= rightCandidate.score ? 'left' : 'right';
    const bestTop = bestSide === 'left' ? leftCandidate.top : rightCandidate.top;

    this._panelSide = bestSide;
    this.panelTopPx = bestTop;
  }

  private _injectMapboxCss() {
    const id = 'mapbox-gl-css';
    if (this._document.getElementById(id)) return;
    const link = this._document.createElement('link');
    link.id = id;
    link.rel = 'stylesheet';
    link.href = MAPBOX_CSS_URL;
    link.crossOrigin = 'anonymous';
    link.referrerPolicy = 'strict-origin-when-cross-origin';
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

    if (site) {
      const features = this._getAllVisibleFeatures(includeProviders);
      this.routeScopedFeatures = features;
      this._buildCategoryLists(features);
      this.filterEmpty = features.length === 0;
      this.map?.updateSourceData({ ...this.geoJson, features });
      
      // Detect if it's a site or organisation and set context
      const featureIdx = this._findFeatureIndex(site);
      if (featureIdx >= 0) {
        const feature = this.geoJson.features[featureIdx];
        const countryDisplayName = country ? this._getCountryDisplayName(country) : undefined;
        const countyDisplayName = county ? getCountyDisplayName(county) : undefined;
        const baseContext = {
          displayName: this._formatSlugForDisplay(site),
          countyDisplayName,
          countryDisplayName,
          parentPath: buildMapPath({ country, county })
        };
        
        if (feature.properties.featureType === 'Snorkelling Site') {
          this.routeLevel = 'site';
          this.siteContext = baseContext;
          this.organisationContext = null;
        } else {
          this.routeLevel = 'organisation';
          this.organisationContext = baseContext;
          this.siteContext = null;
        }
      }
    } else if (county) {
      const displayName = getCountyDisplayName(county);
      const alsoKnownAs = getCountyAlsoKnownAs(county);
      this.filterContext = { displayName, alsoKnownAs };
      const areaFeatures = this._filterByCounty(county, includeProviders);
      this.routeScopedFeatures = areaFeatures;
      this._buildCategoryLists(areaFeatures);
      this.filterEmpty = areaFeatures.length === 0;
      this.map?.updateSourceData({ ...this.geoJson, features: areaFeatures });
      if (this.map && areaFeatures.length) this.map.fitBoundsToFeatures(areaFeatures);
    } else if (country) {
      const displayName = MAP_COUNTRY_DISPLAY_NAMES[country] ?? country.replace(/\b\w/g, c => c.toUpperCase());
      this.filterContext = { displayName };
      const areaFeatures = this._filterByNation(country, includeProviders);
      this.routeScopedFeatures = areaFeatures;
      this._buildCategoryLists(areaFeatures);
      this.filterEmpty = areaFeatures.length === 0;
      this.map?.updateSourceData({ ...this.geoJson, features: areaFeatures });
      if (this.map && areaFeatures.length) this.map.fitBoundsToFeatures(areaFeatures);
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

  private _getAllVisibleFeatures(includeProviders: boolean): any[] {
    return this.geoJson.features.filter((f: any) => includeProviders || f.properties.featureType === 'Snorkelling Site');
  }

  private _findFeatureIndex(siteSlug: string): number {
    if (!this.geoJson?.features?.length) return -1;
    const { country, county } = this._resolveParams();
    return this._findFeatureIndexByRoute(siteSlug, country, county);
  }

  private _findFeatureIndexByRoute(siteSlug: string, country: string | null, county: string | null): number {
    if (!this.geoJson?.features?.length) return -1;

    const normalisedSite = normaliseSiteSegment(siteSlug);
    if (!normalisedSite) return -1;

    const normalisedCountry = normaliseCountrySegment(country);
    const normalisedCounty = normaliseCountySegment(county);

    return this.geoJson.features.findIndex((feature: any) => {
      const props = feature?.properties ?? {};
      if (slugifyMapSegment(props.name as string) !== normalisedSite) {
        return false;
      }

      const featureCountry = getCountrySlugFromRegion(props.location?.region as string);
      if (normalisedCountry && featureCountry !== normalisedCountry) {
        return false;
      }

      if (normalisedCounty) {
        const featureCounty = getCountySlugFromLocation(props.location);
        if (featureCounty !== normalisedCounty) {
          return false;
        }
      }

      return true;
    });
  }

  // Keep site-route content stable even when map selection is cleared.
  private _getSiteContextFeature(): any | null {
    if (!this.geoJson?.features || this.routeLevel !== 'site') return null;

    const selected = this.selectedFeature;
    if (selected) return selected;

    const { site } = this._resolveParams();
    if (!site) return null;

    const { country, county } = this._resolveParams();
    const idx = this._findFeatureIndexByRoute(site, country, county);
    return idx >= 0 ? this.geoJson.features[idx] ?? null : null;
  }

  private _getOrganisationContextFeature(): any | null {
    if (!this.geoJson?.features || this.routeLevel !== 'organisation') return null;

    const selected = this.selectedFeature;
    if (selected?.properties.featureType !== 'Snorkelling Site') return selected;

    const { site } = this._resolveParams();
    if (!site) return null;

    const { country, county } = this._resolveParams();
    const idx = this._findFeatureIndexByRoute(site, country, county);
    const feature = idx >= 0 ? this.geoJson.features[idx] ?? null : null;
    return feature?.properties.featureType !== 'Snorkelling Site' ? feature : null;
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

  private _abbreviateNearbySiteName(value: string): string {
    const maxChars = 24;
    if (value.length <= maxChars) return value;

    const shortened = value.slice(0, maxChars - 1);
    const lastSpace = shortened.lastIndexOf(' ');
    if (lastSpace > 8) {
      return `${shortened.slice(0, lastSpace)}…`;
    }
    return `${shortened}…`;
  }

  private _getCountryDisplayName(country: string): string {
    return MAP_COUNTRY_DISPLAY_NAMES[country] ?? this._formatSlugForDisplay(country);
  }

  private async _loadCountyDescription(countySlug: string): Promise<void> {
    try {
      const result = await this._http.getCountyDescription(countySlug);
      this.countyDescription = (result?.description ?? '').trim();
      this.countyDescriptionHtml = this.countyDescription ? this._htmler.transform(this.countyDescription) : '';
    } catch {
      this.countyDescription = '';
      this.countyDescriptionHtml = '';
    }
    this.descriptionsLoaded = true;
    this._cdr.detectChanges();
  }

  private async _loadCountryDescription(countrySlug: string): Promise<void> {
    try {
      const result = await this._http.getCountryDescription(countrySlug);
      this.countryDescription = (result?.description ?? '').trim();
      this.countryDescriptionHtml = this.countryDescription ? this._htmler.transform(this.countryDescription) : '';
    } catch {
      this.countryDescription = '';
      this.countryDescriptionHtml = '';
    }
    this.descriptionsLoaded = true;
    this._cdr.detectChanges();
  }

  
}
