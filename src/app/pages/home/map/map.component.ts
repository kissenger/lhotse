import { Component } from '@angular/core';
import { HttpService } from '@shared/services/http.service';
import { MapService } from '@shared/services/map.service';
import { EmailSvgComponent } from '@shared/svg/email/email.component';
import { InstagramSvgComponent } from '@shared/svg/instagram/instagram.component';
import { YoutubeSvgComponent } from '@shared/svg/youtube/youtube.component';
import { LoaderComponent } from '@shared/components/loader/loader.component';
import { LazyServiceInjector } from '@shared/services/lazyloader.service';

@Component({
  standalone: true,
  imports: [YoutubeSvgComponent, InstagramSvgComponent, EmailSvgComponent, LoaderComponent ],
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
    // public map: MapService,
    private _http: HttpService,
  ) {}

  async ngOnInit() {
  
    try {
      this.geoJson = await this._http.getSites(true);
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
