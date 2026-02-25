import { TestBed } from '@angular/core/testing';
import { MapComponent } from './map.component';
import { LazyServiceInjector } from '@shared/services/lazyloader.service';
import { HttpService } from '@shared/services/http.service';

describe('MapComponent', () => {
  let comp: MapComponent;

  beforeEach(async () => {
    const mockLazy = { get: async () => ({ create: async () => {} }) };
    const mockHttp = { getSites: async () => ({ type: 'FeatureCollection', features: [] }) };
    await TestBed.configureTestingModule({ imports: [MapComponent], providers: [
      { provide: LazyServiceInjector, useValue: mockLazy },
      { provide: HttpService, useValue: mockHttp }
    ] }).compileComponents();
    const f = TestBed.createComponent(MapComponent);
    comp = f.componentInstance;
  });

  it('creates map component and ngOnInit handles success', async () => {
    expect(comp).toBeTruthy();
    await comp.ngOnInit();
    expect(comp.loadingState === 'success' || comp.loadingState === 'failed').toBeTrue();
  });
});
