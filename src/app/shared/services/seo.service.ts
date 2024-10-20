import {Injectable} from '@angular/core'; 
import { Meta, Title } from '@angular/platform-browser';

@Injectable({
  providedIn: 'root' // Add this to ensure your SEO service will be app-wide available
})

export class SEOService {

  private _canonicalBaseUrl = 'https://snorkelology.co.uk/'

  constructor(
    private _title: Title, 
    private _meta: Meta) { 
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
}