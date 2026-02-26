import { Component } from '@angular/core';
import { HttpService } from '@shared/services/http.service';
import { SEOService } from '@shared/services/seo.service';
import { MapService } from '@shared/services/map.service';
import { EmailSvgComponent } from '@shared/svg/email/email.component';
import { InstagramSvgComponent } from '@shared/svg/instagram/instagram.component';
import { YoutubeSvgComponent } from '@shared/svg/youtube/youtube.component';
import { LoaderComponent } from '@shared/components/loader/loader.component';
import { LazyServiceInjector } from '@shared/services/lazyloader.service';
import { environment } from '@environments/environment';
import { WebsiteSvgComponent } from '@shared/svg/website/website.component';
import { PhoneSvgComponent } from '@shared/svg/phone/phone.component';
import { FacebookSvgComponent } from '@shared/svg/facebook/facebook.component';
import { CloseIconSvgComponent } from '@shared/svg/closeIcon/closeIcon.component';

@Component({
  standalone: true,
  imports: [YoutubeSvgComponent, InstagramSvgComponent, EmailSvgComponent, WebsiteSvgComponent, 
    FacebookSvgComponent, PhoneSvgComponent, CloseIconSvgComponent, LoaderComponent ],
  // providers: [MapService],
  selector: 'app-map',
  templateUrl: './map.component.html',
  styleUrls: ['./map.component.css'],
})

export class MapComponent {

  public geoJson: any = null;
  public loadingState: 'loading' | 'failed' | 'success' = 'loading';
  public map?: MapService;

  constructor(
    private _lazyServiceInjector: LazyServiceInjector,    
    private _http: HttpService,
    private _seo: SEOService
  ) {}

  async ngOnInit() {
  
    try {
      const visibility = environment.STAGE === 'prod' ? ['Production'] : ['Production', 'Development']
      this.geoJson = await this._http.getSites(visibility);
      // publish each site as a Place with geo coordinates so crawlers can
      // index the map content even though it's part of the home page.
      if (this.geoJson && Array.isArray(this.geoJson.features)) {
        const places = this.geoJson.features.map((f: any) => {
          const coords = f.geometry?.coordinates || [];
          return {
            '@type': 'Place',
            name: f.properties?.name,
            description: f.properties?.description,
            geo: {
              '@type': 'GeoCoordinates',
              latitude: coords[1],
              longitude: coords[0]
            }
          };
        });
        this._seo.addStructuredData({
          '@context': 'https://schema.org',
          '@graph': places
        });
      }
      this.map = await this._lazyServiceInjector.get<MapService>(() =>
        import('@shared/services/map.service').then((m) => m.MapService)
      );
      await this.map.create(this.geoJson);
      this.loadingState = 'success';
    } catch (error) {
      console.log(error);
      this.loadingState = 'failed';
    }
  }

  
}
