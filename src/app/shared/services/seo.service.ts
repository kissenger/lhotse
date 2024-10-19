import {Injectable} from '@angular/core'; 
import { Meta, Title } from '@angular/platform-browser';

@Injectable({
  providedIn: 'root' // Add this to ensure your SEO service will be app-wide available
})
export class SEOService {
  constructor(private title: Title, private meta: Meta) { }

  updateTitle(title: string) {
    this.title.setTitle(title);
  }

  updateCanonincalUrl(url: string) {
    this.meta.updateTag({ name: 'link', rel: 'canonical', href: url})
  }

  updateDescription(desc: string) {
    this.meta.updateTag({ name: 'description', content: desc })
  }

  updateKeywords(kws: string) {
    this.meta.updateTag({ name: 'keywords', content: kws })
  }  
}