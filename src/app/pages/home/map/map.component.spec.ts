import { TestBed } from '@angular/core/testing';
import { MapComponent } from './map.component';
import { LazyServiceInjector } from '@shared/services/lazyloader.service';
import { HttpService } from '@shared/services/http.service';

describe('MapComponent', () => {
  let comp: MapComponent;

  beforeEach(async () => {
    const mockLazy = { get: async () => ({ create: async () => {}, selectionChanged: { subscribe: () => ({ unsubscribe() {} }) } }) };
    const mockHttp = { getSites: async () => ({ type: 'FeatureCollection', features: [] }) };
    await TestBed.configureTestingModule({ imports: [MapComponent], providers: [
      { provide: LazyServiceInjector, useValue: mockLazy },
      { provide: HttpService, useValue: mockHttp }
    ] }).compileComponents();
    const f = TestBed.createComponent(MapComponent);
    comp = f.componentInstance;
  });

  it('creates map component and ngAfterViewInit handles success', async () => {
    expect(comp).toBeTruthy();
    await comp.ngAfterViewInit();
    expect(comp.loadingState).toBe('success');
  });

  it('loads feature data when features are present', async () => {
    // override http.getSites to return a feature
    const http = TestBed.inject(HttpService) as any;
    http.getSites = async () => ({
      type: 'FeatureCollection',
      features: [{
        geometry: { coordinates: [1.23, 4.56] },
        properties: { name: 'Test Site', description: 'A place' }
      }]
    });

    await comp.ngAfterViewInit();
    expect(comp.loadingState).toBe('success');
    expect(comp.geoJson.features[0].properties.name).toBe('Test Site');
    expect(comp.geoJson.features[0].geometry.coordinates[1]).toBe(4.56);
  });
});
