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

  it('updateKeywords sets keywords meta', () => {
    service.updateKeywords('foo,bar');
    const tag = meta.getTag('name="keywords"');
    expect(tag).toBeTruthy();
    expect(tag?.getAttribute('content')).toBe('foo,bar');
  });

  // ...existing code...

  it('updateSocialImage sets og:image and twitter:image', () => {
    service.updateSocialImage('img.jpg');
    expect(meta.getTag('property="og:image"')?.getAttribute('content')).toBe('img.jpg');
    expect(meta.getTag('name="twitter:image"')?.getAttribute('content')).toBe('img.jpg');
  });

  it('updateOpenGraph skips undefined values', () => {
    service.updateOpenGraph({ foo: undefined, bar: 'baz' });
    expect(meta.getTag('property="og:bar"')).toBeTruthy();
    expect(meta.getTag('property="og:foo"')).toBeFalsy();
  });

  it('updateTwitterCard skips undefined values', () => {
    service.updateTwitterCard({ foo: undefined, bar: 'baz' });
    expect(meta.getTag('name="twitter:bar"')).toBeTruthy();
    expect(meta.getTag('name="twitter:foo"')).toBeFalsy();
  });

  it('updateTitle and updateDescription call platform services and add social tags', () => {
    service.updateTitle('My Title');
    expect(title.getTitle()).toBe('My Title');

    // og and twitter versions should also be present
    expect(meta.getTag('property="og:title"')?.getAttribute('content')).toBe('My Title');
    expect(meta.getTag('name="twitter:title"')?.getAttribute('content')).toBe('My Title');

    service.updateDescription('desc');
    const tag = meta.getTag('name="description"');
    expect(tag).toBeTruthy();
    expect(meta.getTag('property="og:description"')?.getAttribute('content')).toBe('desc');
    expect(meta.getTag('name="twitter:description"')?.getAttribute('content')).toBe('desc');
  });

  // ...existing code...

  it('addStructuredData on server uses renderer appendChild', () => {
    // just ensure no exceptions when running server flow
    expect(() => service.addStructuredData('{"@type":"WebSite"}')).not.toThrow();
  });

  it('open graph and twitter helpers create tags', () => {
    service.updateOpenGraph({ site_name: 'Example', type: 'website' });
    expect(meta.getTag('property="og:site_name"')?.getAttribute('content')).toBe('Example');
    expect(meta.getTag('property="og:type"')?.getAttribute('content')).toBe('website');

    service.updateTwitterCard({ card: 'summary', site: '@example' });
    expect(meta.getTag('name="twitter:card"')?.getAttribute('content')).toBe('summary');
    expect(meta.getTag('name="twitter:site"')?.getAttribute('content')).toBe('@example');
  });
});
