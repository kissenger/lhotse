import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import {Inject, Injectable, PLATFORM_ID, Renderer2, RendererFactory2} from '@angular/core'; 
import { Meta, Title } from '@angular/platform-browser';
// import { BlogSanitizerPipe } from '@shared/pipes/blog-sanitizer.pipe';

@Injectable({
  providedIn: 'root' // Add this to ensure your SEO service will be app-wide available
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

  updateCanonincalUrl(url: string) {
    this._meta.updateTag({ name: 'link', rel: 'canonical', href: this._canonicalBaseUrl+url})
  }

  updateDescription(desc: string) {
    this._meta.updateTag({ name: 'description', content: desc})
  }

  updateKeywords(kws: string) { 
    this._meta.updateTag({ name: 'keywords', content: kws})
  }  

  addStructuredData(ldJson: string) {
    if (!isPlatformBrowser(this.platformId)) {
      const script = this._renderer.createElement('script');
      script.type = 'application/ld+json';
      script.text = (ldJson);
      this._renderer.appendChild(this._document.head, script);
    }
  }

}

