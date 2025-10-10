import { Component } from '@angular/core';
import { HttpService } from '@shared/services/http.service';
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

@Component({
  standalone: true,
  imports: [YoutubeSvgComponent, InstagramSvgComponent, EmailSvgComponent, WebsiteSvgComponent, 
    FacebookSvgComponent, PhoneSvgComponent, LoaderComponent ],
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
  ) {}

  async ngOnInit() {
  
    try {
      const visibility = environment.STAGE === 'prod' ? ['Production'] : ['Production', 'Development']
      this.geoJson = await this._http.getSites(visibility);
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

  checkforPhone(iconArr: [{icon: string, text?: string, url?: string}]) {
    const phone = iconArr.find(a => a.icon === "phone")
    console.log(phone)
    return phone?.text
  }  
  
}
