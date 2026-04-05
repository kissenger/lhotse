import { TestBed } from '@angular/core/testing';
import { CarouselComponent } from './carousel.component';
import { PLATFORM_ID } from '@angular/core';
import { CarouselImages } from '@shared/types';

const MOCK_IMAGES: CarouselImages = [
  { src: 'a.jpg', alt: 'Image A' },
  { src: 'b.jpg', alt: 'Image B' },
  { src: 'c.jpg', alt: 'Image C' },
];

function buildCarousel(platformId = 'browser') {
  TestBed.configureTestingModule({
    imports: [CarouselComponent],
    providers: [{ provide: PLATFORM_ID, useValue: platformId }]
  });
  const f = TestBed.createComponent(CarouselComponent);
  const comp = f.componentInstance;
  comp.images = [...MOCK_IMAGES];

  // Stub ViewChildren / ViewChild needed by ngAfterViewInit
  const makeEl = (extra?: any) => ({ nativeElement: { style: { setProperty: () => {}, transitionProperty: '', transform: '' }, ...extra } });
  comp['carousel'] = makeEl() as any;
  comp['carouselImages'] = { forEach: (_fn: any) => {} } as any;

  return comp;
}

describe('CarouselComponent', () => {

  afterEach(() => TestBed.resetTestingModule());

  it('creates carousel', () => {
    const comp = buildCarousel();
    expect(comp).toBeTruthy();
  });

  it('ngOnInit appends a duplicate of the first image (loop wrap)', () => {
    const comp = buildCarousel();
    const originalLength = comp.images.length;
    comp.ngOnInit();
    // A copy of images[0] should have been pushed
    expect(comp.images.length).toBe(originalLength + 1);
    expect(comp.images[comp.images.length - 1].src).toBe(comp.images[0].src);
  });

  it('showNextImage advances the index', async () => {
    const comp = buildCarousel();
    comp.ngOnInit();
    const before = comp['_currentImage'];
    await comp.showNextImage();
    expect(comp['_currentImage']).toBe(before + 1);
  });

  it('showPrevImage decrements the index', async () => {
    const comp = buildCarousel();
    comp.ngOnInit();
    // Move forward first so we have somewhere to go back to
    await comp.showNextImage();
    const before = comp['_currentImage'];
    await comp.showPrevImage();
    expect(comp['_currentImage']).toBe(before - 1);
  });

  it('showNextImage wraps around from last to first', async () => {
    const comp = buildCarousel();
    comp.ngOnInit();
    // Jump to last image (images.length - 1)
    comp['_currentImage'] = comp.images.length - 1;
    await comp.showNextImage();
    expect(comp['_currentImage']).toBe(1);
  });

  it('showPrevImage wraps around from first to last', async () => {
    const comp = buildCarousel();
    comp.ngOnInit();
    comp['_currentImage'] = 0;
    await comp.showPrevImage();
    expect(comp['_currentImage']).toBe(comp.images.length - 2);
  });

  it('ngAfterViewInit sets --number-of-images CSS variable', () => {
    const comp = buildCarousel();
    comp.ngOnInit();
    const setPropertySpy = jasmine.createSpy('setProperty');
    comp['carousel'] = { nativeElement: { style: { setProperty: setPropertySpy, transitionProperty: '', transform: '' } } } as any;
    comp.ngAfterViewInit();
    expect(setPropertySpy).toHaveBeenCalledWith('--number-of-images', jasmine.any(String));
  });

  it('ngOnDestroy unsubscribes the timer', () => {
    const comp = buildCarousel();
    comp.autoAdvance = true;
    comp.ngOnInit();
    comp.ngAfterViewInit();
    const unsubSpy = jasmine.createSpy('unsubscribe');
    comp['_timerSubscription'] = { unsubscribe: unsubSpy } as any;
    comp.ngOnDestroy();
    expect(unsubSpy).toHaveBeenCalled();
  });
});
