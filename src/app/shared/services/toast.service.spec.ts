import { TestBed } from '@angular/core/testing';
import { ToastService } from './toast.service';

describe('ToastService', () => {
  let service: ToastService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ToastService);
  });

  it('init should throw when no view container provided', () => {
    expect(() => service.init(undefined as any)).toThrow();
  });

  it('show should create component and append element', () => {
    const appendSpy = jasmine.createSpy('appendChild');
    const fakeElement: any = { nativeElement: { appendChild: appendSpy } };
    const fakeCompRef: any = {
      instance: { dismiss: { subscribe: () => {} }, message: '' },
      location: { nativeElement: { children: [ { classList: { add: () => {}, remove: () => {} } } ] } },
      destroy: () => {}
    };
    const vcr: any = {
      element: fakeElement,
      createComponent: () => fakeCompRef
    };

    service.init(vcr);
    service.show('hello', 'success', 10);
    expect(appendSpy).toHaveBeenCalled();
    expect(fakeCompRef.instance.message).toBeTruthy();
  });
});
