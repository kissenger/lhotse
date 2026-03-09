import { TestBed } from '@angular/core/testing';
import { MapService } from './map.service';

describe('MapService', () => {
  let svc: MapService;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [MapService] });
    svc = TestBed.inject(MapService);
  });

  it('indexOfArrayMaximum returns -1 for undefined and correct index otherwise', () => {
    expect(svc.indexOfArrayMaximum(undefined)).toBe(-1);
    expect(svc.indexOfArrayMaximum([1,5,3])).toBe(1);
  });

  it('selectedSymbolId and popupPosition behave when nothing selected', () => {
    expect(svc.selectedSymbolId).toBeUndefined();
    expect(svc.popupPosition).toBe('none');
  });

  it('exists returns false when map is undefined, true when set', () => {
    expect(svc.exists).toBe(false);
    (svc as any)._map = {};
    expect(svc.exists).toBe(true);
  });

  it('indexOfArrayMaximum returns 0 for single-element array', () => {
    expect(svc.indexOfArrayMaximum([42])).toBe(0);
  });

  it('deselectSymbol sets selectedFeature to null and calls setFeatureState', () => {
    (svc as any)._map = { setFeatureState: jasmine.createSpy('setFeatureState') };
    svc.selectedFeature = { id: 1 };
    svc.deselectSymbol();
    expect(svc.selectedFeature).toBeNull();
    expect((svc as any)._map.setFeatureState).toHaveBeenCalled();
  });

  it('popupPosition returns left or right based on x position', () => {
    // Setup for left
    svc.selectedFeature = { id: 0 };
    (svc as any)._sites = { features: [{ geometry: { coordinates: [0,0] } }] };
    (svc as any)._map = {
      project: () => ({ x: 400 }),
      getContainer: () => ({ clientWidth: 800 })
    } as any;
    expect(svc.popupPosition).toBe('left');
    // Setup for right
    (svc as any)._map = {
      project: () => ({ x: 100 }),
      getContainer: () => ({ clientWidth: 800 })
    } as any;
    expect(svc.popupPosition).toBe('right');
  });
});
