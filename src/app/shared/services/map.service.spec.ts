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
});
