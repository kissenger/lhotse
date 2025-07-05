import { Component } from '@angular/core';
import { HttpService } from '@shared/services/http.service';
import { MapService } from '@shared/services/map.service';

@Component({
  standalone: true,
  imports: [],
  selector: 'app-map',
  templateUrl: './map.component.html',
  styleUrls: ['./map.component.css'],
})

export class MapComponent {

  constructor(
    private _map: MapService,
    private _http: HttpService,
  ) {}

  async ngOnInit() {
    let sites = await this._http.getSites(true);
    this._map.create(sites);
  }

}
