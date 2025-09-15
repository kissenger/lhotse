import { Component } from '@angular/core';
import { HttpService } from '@shared/services/http.service';
import { MapService } from '@shared/services/map.service';
import { EmailSvgComponent } from '@shared/svg/email/email.component';
import { InstagramSvgComponent } from '@shared/svg/instagram/instagram.component';
import { YoutubeSvgComponent } from '@shared/svg/youtube/youtube.component';
import { LoaderComponent } from '@shared/components/loader/loader.component';

@Component({
  standalone: true,
  imports: [YoutubeSvgComponent, InstagramSvgComponent, EmailSvgComponent, LoaderComponent ],
  selector: 'app-map',
  templateUrl: './map.component.html',
  styleUrls: ['./map.component.css'],
})

export class MapComponent {

  public geoJson: any = null;
  public loadingState: 'loading' | 'failed' | 'success' = 'loading';

  constructor(
    public map: MapService,
    private _http: HttpService,
  ) {}

  async ngOnInit() {
  
    try {
      this.geoJson = await this._http.getSites(true);
      await this.map.create(this.geoJson);
      this.loadingState = 'success';
    } catch (error) {
      console.log(error);
      this.loadingState = 'failed';
    }
  }
  
}
