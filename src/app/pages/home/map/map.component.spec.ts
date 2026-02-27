import { TestBed } from '@angular/core/testing';
import { MapComponent } from './map.component';
import { SEOService } from '@shared/services/seo.service';
import { LazyServiceInjector } from '@shared/services/lazyloader.service';
import { HttpService } from '@shared/services/http.service';

describe('MapComponent', () => {
  let comp: MapComponent;

  beforeEach(async () => {
    const mockLazy = { get: async () => ({ create: async () => {}, selectionChanged: { subscribe: () => ({ unsubscribe() {} }) } }) };
    const mockHttp = { getSites: async () => ({ type: 'FeatureCollection', features: [] }) };
    const mockSeo = { addStructuredData: jasmine.createSpy('addStructuredData') };
    await TestBed.configureTestingModule({ imports: [MapComponent], providers: [
      { provide: LazyServiceInjector, useValue: mockLazy },
      { provide: HttpService, useValue: mockHttp }
      , { provide: SEOService, useValue: mockSeo }
    ] }).compileComponents();
    const f = TestBed.createComponent(MapComponent);
    comp = f.componentInstance;
  });

  it('creates map component and ngAfterViewInit handles success', async () => {
    expect(comp).toBeTruthy();
    await comp.ngAfterViewInit();
    expect(comp.loadingState === 'success' || comp.loadingState === 'failed').toBeTrue();
    // structured data call should occur even when empty list is returned
    const seo = TestBed.inject(SEOService) as any;
    expect(seo.addStructuredData).toHaveBeenCalled();
  });

  it('adds Place structured data when features present', async () => {
    // override http.getSites to return a feature
    const http = TestBed.inject(HttpService) as any;
    http.getSites = async () => ({
      type: 'FeatureCollection',
      features: [{
        geometry: { coordinates: [1.23, 4.56] },
        properties: { name: 'Test Site', description: 'A place' }
      }]
    });
    const seo = TestBed.inject(SEOService) as any;
    seo.addStructuredData.calls.reset();

    await comp.ngAfterViewInit();
    expect(seo.addStructuredData).toHaveBeenCalled();
    const arg = seo.addStructuredData.calls.mostRecent().args[0];
    expect(arg['@graph']).toBeDefined();
    expect(arg['@graph'][0].name).toBe('Test Site');
    expect(arg['@graph'][0].geo.latitude).toBe(4.56);
  });
});
