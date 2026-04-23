import { TestBed } from '@angular/core/testing';
import { MapComponent } from './map.component';
import { LazyServiceInjector } from '@shared/services/lazyloader.service';
import { HttpService } from '@shared/services/http.service';
import { ActivatedRoute } from '@angular/router';
import { Location } from '@angular/common';

// Test fixtures — coordinates are [lng, lat]
const SITE_A = {
  type: 'Feature', id: 0,
  geometry: { coordinates: [0, 51] },
  properties: { name: 'Site A', featureType: 'Snorkelling Site', categories: [], location: { adminLevel3: 'Kent' } }
};
const SITE_B = {
  type: 'Feature', id: 1,
  geometry: { coordinates: [0.05, 51.03] }, // ~4.8 km from Site A
  properties: { name: 'Site B', featureType: 'Snorkelling Site', categories: [], location: { adminLevel3: 'Kent' } }
};
const SITE_C = {
  type: 'Feature', id: 2,
  geometry: { coordinates: [2, 53] }, // ~261 km from Site A
  properties: { name: 'Site C', featureType: 'Snorkelling Site', categories: [], location: { adminLevel3: 'Yorkshire' } }
};
const PROVIDER_KENT = {
  type: 'Feature', id: 3,
  geometry: { coordinates: [0.02, 51.01] }, // ~1.8 km from Site A
  properties: { name: 'Provider Kent', featureType: 'Organisation', categories: [], location: { adminLevel3: 'Kent' } }
};

const ALL_FEATURES = [SITE_A, SITE_B, SITE_C, PROVIDER_KENT];

function buildMap(pathParams: Record<string, string> = {}, queryParams: Record<string, string> = {}, features = ALL_FEATURES) {
  const mockQueryParamMap = { get: (key: string) => queryParams[key] ?? null };
  const mockParamMap = { get: (key: string) => pathParams[key] ?? null };
  const mockRoute = { snapshot: { queryParamMap: mockQueryParamMap, paramMap: mockParamMap } };

  const mockMapService = {
    create: jasmine.createSpy('create').and.returnValue(Promise.resolve()),
    selectionChanged: { subscribe: () => ({ unsubscribe() {} }) },
    flyToAndSelect: jasmine.createSpy('flyToAndSelect'),
    fitBoundsToFeatures: jasmine.createSpy('fitBoundsToFeatures'),
    updateSourceData: jasmine.createSpy('updateSourceData'),
    clearSelection: jasmine.createSpy('clearSelection'),
    selectedFeature: null,
  };

  const mockLazy = { get: jasmine.createSpy('get').and.returnValue(Promise.resolve(mockMapService)) };
  const mockHttp = {
    getSites: jasmine.createSpy('getSites').and.returnValue(
      Promise.resolve({ type: 'FeatureCollection', features: [...features] })
    )
  };

  TestBed.configureTestingModule({
    imports: [MapComponent],
    providers: [
      { provide: LazyServiceInjector, useValue: mockLazy },
      { provide: HttpService, useValue: mockHttp },
      { provide: ActivatedRoute, useValue: mockRoute },
      { provide: Location, useValue: { replaceState: jasmine.createSpy('replaceState') } },
    ]
  });

  const fixture = TestBed.createComponent(MapComponent);
  const comp = fixture.componentInstance;
  return { comp, mockMapService, mockHttp };
}

describe('MapComponent', () => {
  afterEach(() => TestBed.resetTestingModule());

  // --- Baseline ---

  it('creates and loads successfully with no query params', async () => {
    const { comp } = buildMap();
    await comp.ngAfterViewInit();
    expect(comp.loadingState).toBe('success');
  });

  it('sets siteContext from a site route path', () => {
    const { comp } = buildMap({ country: 'england', county: 'east-riding-of-yorkshire', siteName: 'flamborough-head' });
    comp.ngOnInit();
    expect(comp.siteContext?.displayName).toBe('Flamborough Head');
    expect(comp.siteContext?.countyDisplayName).toBe('East Riding of Yorkshire');
    expect(comp.siteContext?.countryDisplayName).toBe('England');
  });

  it('displays loaded feature data', async () => {
    const { comp, mockHttp } = buildMap();
    mockHttp.getSites.and.returnValue(Promise.resolve({
      type: 'FeatureCollection',
      features: [{ geometry: { coordinates: [1.23, 4.56] }, properties: { name: 'Test Site', description: 'A place' } }]
    }));
    await comp.ngAfterViewInit();
    expect(comp.geoJson.features[0].properties.name).toBe('Test Site');
    expect(comp.geoJson.features[0].geometry.coordinates[1]).toBe(4.56);
  });

  // --- ?county ---

  it('county filter includes providers by default', async () => {
    const { comp, mockMapService } = buildMap({ country: 'england', county: 'kent' });
    await comp.ngAfterViewInit();
    const filtered = mockMapService.updateSourceData.calls.mostRecent().args[0];
    expect(filtered.features.length).toBe(3); // Site A, Site B, Provider Kent
    expect(filtered.features.every((f: any) => f.properties.location.adminLevel3 === 'Kent')).toBeTrue();
  });

  it('county filter excludes providers when includeProviders=false', async () => {
    const { comp, mockMapService } = buildMap({ country: 'england', county: 'kent' }, { includeProviders: 'false' });
    await comp.ngAfterViewInit();
    const filtered = mockMapService.updateSourceData.calls.mostRecent().args[0];
    expect(filtered.features.length).toBe(2); // Site A, Site B only
    expect(filtered.features.every((f: any) => f.properties.featureType === 'Snorkelling Site')).toBeTrue();
  });

  it('calls fitBoundsToFeatures for county filter', async () => {
    const { comp, mockMapService } = buildMap({ country: 'england', county: 'kent' });
    await comp.ngAfterViewInit();
    expect(mockMapService.fitBoundsToFeatures).toHaveBeenCalledWith(
      jasmine.arrayContaining([jasmine.objectContaining({ properties: jasmine.objectContaining({ name: 'Site A' }) })])
    );
    expect(mockMapService.fitBoundsToFeatures.calls.mostRecent().args[0].length).toBe(3);
  });

  it('county filter is case-insensitive', async () => {
    const { comp, mockMapService } = buildMap({ country: 'england', county: 'kent' });
    await comp.ngAfterViewInit();
    const filtered = mockMapService.updateSourceData.calls.mostRecent().args[0];
    expect(filtered.features.length).toBe(3);
  });

  it('county filter matches on county field when present, ignoring adminLevel3', async () => {
    const scilly = {
      type: 'Feature', id: 4,
      geometry: { coordinates: [-6.3, 49.9] },
      properties: { name: 'Scilly Site', featureType: 'Snorkelling Site', categories: [], location: { county: 'Cornwall', adminLevel3: 'Isles of Scilly' } }
    };
    const { comp, mockMapService } = buildMap({ country: 'england', county: 'cornwall' }, {}, [...ALL_FEATURES, scilly]);
    await comp.ngAfterViewInit();
    const filtered = mockMapService.updateSourceData.calls.mostRecent().args[0];
    expect(filtered.features.length).toBe(1);
    expect(filtered.features[0].properties.name).toBe('Scilly Site');
  });

  it('county filter falls back to adminLevel3 when county field is empty', async () => {
    const { comp, mockMapService } = buildMap({ country: 'england', county: 'kent' });
    await comp.ngAfterViewInit();
    const filtered = mockMapService.updateSourceData.calls.mostRecent().args[0];
    // Fixtures have no county field set, so fallback to adminLevel3 applies
    expect(filtered.features.length).toBe(3);
  });

  it('county filter returns empty when no match', async () => {
    const { comp, mockMapService } = buildMap({ country: 'england', county: 'cornwall' });
    await comp.ngAfterViewInit();
    const filtered = mockMapService.updateSourceData.calls.mostRecent().args[0];
    expect(filtered.features.length).toBe(0);
  });

  // --- ?site ---

  it('calls flyToAndSelect when site param matches', async () => {
    const { comp, mockMapService } = buildMap({ country: 'england', county: 'kent', siteName: 'site-a' });
    await comp.ngAfterViewInit();
    expect(mockMapService.flyToAndSelect).toHaveBeenCalledWith(0, [0, 51] as any);
  });

  it('site lookup is case-insensitive', async () => {
    const { comp, mockMapService } = buildMap({ country: 'england', county: 'kent', siteName: 'site-a' });
    await comp.ngAfterViewInit();
    expect(mockMapService.flyToAndSelect).toHaveBeenCalledWith(0, [0, 51] as any);
  });

  it('does not call flyToAndSelect for unknown site name', async () => {
    const { comp, mockMapService } = buildMap({ country: 'england', county: 'kent', siteName: 'unknown-site' });
    await comp.ngAfterViewInit();
    expect(mockMapService.flyToAndSelect).not.toHaveBeenCalled();
  });

  // --- ?site + ?sitesWithin ---

  it('filters to nearby features when sitesWithin is provided (km suffix)', async () => {
    const { comp, mockMapService } = buildMap({ country: 'england', county: 'kent', siteName: 'site-a' }, { sitesWithin: '10km' });
    await comp.ngAfterViewInit();
    const filtered = mockMapService.updateSourceData.calls.mostRecent().args[0];
    // Site A, Site B (~4.8km), Provider Kent (~1.8km) within 10km; Site C (~261km) excluded
    expect(filtered.features.length).toBe(3);
    expect(filtered.features.some((f: any) => f.properties.name === 'Site A')).toBeTrue();
    expect(filtered.features.some((f: any) => f.properties.name === 'Site B')).toBeTrue();
    expect(filtered.features.some((f: any) => f.properties.name === 'Provider Kent')).toBeTrue();
    expect(filtered.features.some((f: any) => f.properties.name === 'Site C')).toBeFalse();
  });

  it('sitesWithin excludes providers when includeProviders=false', async () => {
    const { comp, mockMapService } = buildMap({ country: 'england', county: 'kent', siteName: 'site-a' }, { sitesWithin: '10km', includeProviders: 'false' });
    await comp.ngAfterViewInit();
    const filtered = mockMapService.updateSourceData.calls.mostRecent().args[0];
    expect(filtered.features.length).toBe(2); // Site A, Site B only
    expect(filtered.features.some((f: any) => f.properties.name === 'Provider Kent')).toBeFalse();
  });

  it('calls fitBoundsToFeatures without selectId when sitesWithin is provided', async () => {
    const { comp, mockMapService } = buildMap({ country: 'england', county: 'kent', siteName: 'site-a' }, { sitesWithin: '10km' });
    await comp.ngAfterViewInit();
    expect(mockMapService.flyToAndSelect).not.toHaveBeenCalled();
    expect(mockMapService.fitBoundsToFeatures).toHaveBeenCalledWith(
      jasmine.arrayContaining([jasmine.objectContaining({ properties: jasmine.objectContaining({ name: 'Site A' }) })])
    );
    expect(mockMapService.fitBoundsToFeatures.calls.mostRecent().args.length).toBe(1);
  });

  it('parses sitesWithin without unit suffix', async () => {
    const { comp, mockMapService } = buildMap({ country: 'england', county: 'kent', siteName: 'site-a' }, { sitesWithin: '10' });
    await comp.ngAfterViewInit();
    const filtered = mockMapService.updateSourceData.calls.mostRecent().args[0];
    expect(filtered.features.length).toBe(3); // Site A, Site B (~4.8km), Provider Kent (~1.8km)
  });

  it('does not filter when sitesWithin site name is unknown', async () => {
    const { comp, mockMapService } = buildMap({ country: 'england', county: 'kent', siteName: 'unknown' }, { sitesWithin: '10km' });
    await comp.ngAfterViewInit();
    expect(mockMapService.updateSourceData).not.toHaveBeenCalled();
    expect(mockMapService.flyToAndSelect).not.toHaveBeenCalled();
  });
});
