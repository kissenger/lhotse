import { TestBed } from '@angular/core/testing';
import { ToastComponent } from './toast.component';

describe('ToastComponent', () => {
  let comp: ToastComponent;
  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [ToastComponent] }).compileComponents();
    const f = TestBed.createComponent(ToastComponent);
    comp = f.componentInstance;
  });

  it('creates and has dismiss emitter', () => {
    expect(comp).toBeTruthy();
    expect(comp.dismiss).toBeDefined();
  });
});
