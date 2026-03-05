import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import {Inject, Injectable, PLATFORM_ID, Renderer2, RendererFactory2} from '@angular/core'; 
import { Meta, Title } from '@angular/platform-browser';
import { SchemaOrganization, SchemaBlogPosting, SchemaProduct, SchemaFAQPage, SchemaBreadcrumb } from '@shared/types';

@Injectable({
  providedIn: 'root'
})

export class SEOService {

  private _canonicalBaseUrl = 'https://snorkelology.co.uk/'
  private _renderer: Renderer2;
  private _structuredDataCache = new Set<string>();
  
  constructor(
    @Inject(DOCUMENT) private _document: Document,
    @Inject(PLATFORM_ID) private platformId: Object,
    private _title: Title, 
    private _meta: Meta,
    private _rendererFactory: RendererFactory2

  ) { 
      this._renderer = _rendererFactory.createRenderer(null, null);
    }

  updateTitle(title: string) {
    this._title.setTitle(title);

    // mirror title into social tags so each page has OpenGraph/Twitter titles
    this.updateOpenGraph({ title });
    this.updateTwitterCard({ title });
  }

  updateCanonicalUrl(url: string) {
    const href = this._canonicalBaseUrl + url;
    this._meta.updateTag({ name: 'link', rel: 'canonical', href });

    // add to social metadata too
    this.updateOpenGraph({ url: href });
  }


  // Add hreflang support
  updateHreflang(lang: string, url: string) {
    // Remove existing hreflang for this lang
    const selector = `link[rel='alternate'][hreflang='${lang}']`;
    const existing = this._document.head.querySelector(selector);
    if (existing) {
      this._document.head.removeChild(existing);
    }
    // Add new hreflang link
    const link = this._renderer.createElement('link');
    link.rel = 'alternate';
    link.hreflang = lang;
    link.href = url;
    this._renderer.appendChild(this._document.head, link);
  }

  updateDescription(desc: string) {
    this._meta.updateTag({ name: 'description', content: desc});

    // keep OG/twitter description in sync
    this.updateOpenGraph({ description: desc });
    this.updateTwitterCard({ description: desc });
  }

  updateKeywords(kws: string) { 
    this._meta.updateTag({ name: 'keywords', content: kws});
  }  

  /**
   * Add structured data (JSON-LD) to the document head.
   * Only injects during SSR (on server), not in browser for crawlers.
   * @param ldJson Raw JSON-LD string or object
   */
  addStructuredData(ldJson: string | object) {
    if (!isPlatformBrowser(this.platformId)) {
      const serialized = typeof ldJson === 'string' ? ldJson : JSON.stringify(ldJson);
      if (this._structuredDataCache.has(serialized)) {
        return;
      }
      this._structuredDataCache.add(serialized);

      const script = this._renderer.createElement('script');
      script.type = 'application/ld+json';
      script.text = serialized;
      this._renderer.appendChild(this._document.head, script);
    }
  }

  /**
   * Generic helper to update one or more OpenGraph properties.
   * Accepts an object of property:value pairs (without the "og:" prefix).
   */
  updateOpenGraph(tags: {[key: string]: string | undefined}) {
    Object.entries(tags).forEach(([key, value]) => {
      if (!value) { return; }
      this._meta.updateTag({ property: `og:${key}`, content: value });
    });
  }

  /**
   * Generic helper to update Twitter card meta tags. The keys should come
   * without the "twitter:" prefix (e.g. {card: 'summary', title: '...' }).
   */
  updateTwitterCard(tags: {[key: string]: string | undefined}) {
    Object.entries(tags).forEach(([key, value]) => {
      if (!value) { return; }
      this._meta.updateTag({ name: `twitter:${key}`, content: value });
    });
  }

  /**
   * Convenience for setting the social image on both networks.
   */
  updateSocialImage(url: string) {
    if (!url) { return; }
    this.updateOpenGraph({ image: url });
    this.updateTwitterCard({ image: url });
  }

  /**
   * Add Organization schema (company/site identity)
   */
  addOrganizationSchema(org: SchemaOrganization) {
    this.addStructuredData(org);
  }

  /**
   * Add BlogPosting schema (for blog articles)
   */
  addBlogPostingSchema(blog: SchemaBlogPosting) {
    this.addStructuredData(blog);
  }

  /**
   * Add Product schema (for e-commerce items)
   */
  addProductSchema(product: SchemaProduct) {
    this.addStructuredData(product);
  }

  /**
   * Add FAQPage schema (for FAQ collections)
   */
  addFAQPageSchema(faqPage: SchemaFAQPage) {
    this.addStructuredData(faqPage);
  }

  /**
   * Add BreadcrumbList schema (for navigation hierarchy)
   */
  addBreadcrumbSchema(breadcrumb: SchemaBreadcrumb) {
    this.addStructuredData(breadcrumb);
  }

}

