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
  }

  updateCanonicalUrl(url: string) {
    this._meta.updateTag({ name: 'link', rel: 'canonical', href: this._canonicalBaseUrl+url})
  }

  // Deprecated: Use updateCanonicalUrl instead
  updateCanonincalUrl(url: string) {
    this.updateCanonicalUrl(url);
  }

  updateDescription(desc: string) {
    this._meta.updateTag({ name: 'description', content: desc})
  }

  updateKeywords(kws: string) { 
    this._meta.updateTag({ name: 'keywords', content: kws})
  }  

  /**
   * Add structured data (JSON-LD) to the document head.
   * Only injects during SSR (on server), not in browser for crawlers.
   * @param ldJson Raw JSON-LD string or object
   */
  addStructuredData(ldJson: string | object) {
    if (!isPlatformBrowser(this.platformId)) {
      const script = this._renderer.createElement('script');
      script.type = 'application/ld+json';
      script.text = typeof ldJson === 'string' ? ldJson : JSON.stringify(ldJson);
      this._renderer.appendChild(this._document.head, script);
    }
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

