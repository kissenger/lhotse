import { TestBed } from '@angular/core/testing';
import { SEOService } from './seo.service';
import { Meta, Title } from '@angular/platform-browser';
import { Renderer2, RendererFactory2, PLATFORM_ID } from '@angular/core';
import { DOCUMENT } from '@angular/common';

describe('SEOService', () => {
  let service: SEOService;
  let meta: Meta;
  let title: Title;

  beforeEach(() => {
    const rendererFactory = {
      createRenderer: () => ({ createElement: () => ({ type: '', text: '', }), appendChild: () => {} })
    } as any as RendererFactory2;

    TestBed.configureTestingModule({
      providers: [
        SEOService,
        { provide: RendererFactory2, useValue: rendererFactory },
        { provide: DOCUMENT, useValue: document },
        { provide: PLATFORM_ID, useValue: 'server' }
      ],
    });
    service = TestBed.inject(SEOService);
    meta = TestBed.inject(Meta);
    title = TestBed.inject(Title);
  });

  it('updateTitle and updateDescription call platform services', () => {
    service.updateTitle('My Title');
    expect(title.getTitle()).toBe('My Title');
    service.updateDescription('desc');
    const tag = meta.getTag('name="description"');
    expect(tag).toBeTruthy();
  });

  it('updateCanonicalUrl adds canonical meta', () => {
    service.updateCanonincalUrl('page');
    const tag = meta.getTag('rel=canonical') || meta.getTag('name=link');
    expect(tag).toBeTruthy();
  });

  it('addStructuredData on server uses renderer appendChild', () => {
    // just ensure no exceptions when running server flow
    expect(() => service.addStructuredData('{"@type":"WebSite"}')).not.toThrow();
  });
});
