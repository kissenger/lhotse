import { Component } from '@angular/core';
import { HttpService } from '@shared/services/http.service';
import { LazyServiceInjector } from '@shared/services/lazyloader.service';
import type { MapService } from '@shared/services/map.service';
import { ScrollspyService } from '@shared/services/scrollspy.service';
import { EmailSvgComponent } from '@shared/svg/email/email.component';
import { InstagramSvgComponent } from '@shared/svg/instagram/instagram.component';
import { YoutubeSvgComponent } from '@shared/svg/youtube/youtube.component';
import { LoaderComponent } from '@shared/components/loader/loader.component';
import { Subscription } from 'rxjs';

@Component({
  standalone: true,
  imports: [YoutubeSvgComponent, InstagramSvgComponent, EmailSvgComponent, LoaderComponent ],
  selector: 'app-map',
  templateUrl: './map.component.html',
  styleUrls: ['./map.component.css'],
})

export class MapComponent {

  public geoJson: any;
  private _scrSubs: Subscription | null = null;
  public map?: MapService;

  constructor(
    // public map: MapService,
    private _lazyServiceInjector: LazyServiceInjector,
    private _http: HttpService,
    private _scrollSpy: ScrollspyService,
    
  ) {}

  async ngOnInit() {
    // lazy load map to minimise loading charges
    this.geoJson = await this._http.getSites(true);
    this._scrSubs = this._scrollSpy.intersectionEmitter.subscribe( async (isect) => {
      if (isect.ratio > 0.2) {
        if (isect.id === "snorkelling-map-of-britain") {
          if (!this.map) {
            this.map = await this._lazyServiceInjector.get<MapService>(() =>
              import('@shared/services/map.service').then((m) => m.MapService)
            );
            this.map.create(this.geoJson);
          }
        }        
      }
    })
  }

  ngOnDestroy() {
    this._scrSubs?.unsubscribe();
  }


}
