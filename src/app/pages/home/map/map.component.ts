import { Component } from '@angular/core';
import { HttpService } from '@shared/services/http.service';
import { MapService } from '@shared/services/map.service';
import { EmailSvgComponent } from '@shared/svg/email/email.component';
import { InstagramSvgComponent } from '@shared/svg/instagram/instagram.component';
import { YoutubeSvgComponent } from '@shared/svg/youtube/youtube.component';

@Component({
  standalone: true,
  imports: [YoutubeSvgComponent, InstagramSvgComponent, EmailSvgComponent ],
  selector: 'app-map',
  templateUrl: './map.component.html',
  styleUrls: ['./map.component.css'],
})

export class MapComponent {

  public geoJson: any;

  constructor(
    public map: MapService,
    private _http: HttpService,
  ) {}

  async ngOnInit() {
    this.geoJson = await this._http.getSites(true);
    console.log(this.geoJson)
    this.map.create(this.geoJson);
  }


}
