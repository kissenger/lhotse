import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { HttpService } from '@shared/services/http.service';
import { MapService } from '@shared/services/map.service';

@Component({
  standalone: true,
  imports: [RouterLink],
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
