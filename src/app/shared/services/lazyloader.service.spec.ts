import { TestBed } from '@angular/core/testing';
import { LazyServiceInjector } from './lazyloader.service';

describe('LazyServiceInjector', () => {
  let svc: LazyServiceInjector;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [{ provide: 'X', useValue: 42 }] });
    svc = TestBed.inject(LazyServiceInjector);
  });

  it('get() should resolve provider loader and return injected value', async () => {
    const loader = async () => 'X' as any;
    const val = await svc.get(loader as any);
    expect(val).toBe(42);
  });
});
