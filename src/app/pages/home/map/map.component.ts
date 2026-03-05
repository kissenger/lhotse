import { Component, AfterViewInit, ChangeDetectorRef, OnDestroy } from '@angular/core';
import { NgClass } from '@angular/common';
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
import { CloseIconSvgComponent } from '@shared/svg/closeIcon/closeIcon.component';

@Component({
  standalone: true,
  imports: [YoutubeSvgComponent, InstagramSvgComponent, EmailSvgComponent, WebsiteSvgComponent, 
    FacebookSvgComponent, PhoneSvgComponent, CloseIconSvgComponent, LoaderComponent, NgClass ],
  // providers: [MapService],
  selector: 'app-map',
  templateUrl: './map.component.html',
  styleUrls: ['./map.component.css'],
})

export class MapComponent implements AfterViewInit, OnDestroy {

  public geoJson: any = null;
  public loadingState: 'loading' | 'failed' | 'success' = 'loading';
  public map?: MapService;
  private _selectionSub?: import('rxjs').Subscription;

  constructor(
    private _lazyServiceInjector: LazyServiceInjector,    
    private _http: HttpService,
    private _cdr: ChangeDetectorRef
  ) {}

  async ngAfterViewInit() {
  
    try {
      const visibility = environment.STAGE === 'prod' ? ['Production'] : ['Production', 'Development']
      this.geoJson = await this._http.getSites(visibility);
      this.map = await this._lazyServiceInjector.get<MapService>(() =>
        import('@shared/services/map.service').then((m) => m.MapService)
      );
      await this.map.create(this.geoJson);
      // React to selection changes coming from MapService (mapbox events)
      this._selectionSub = this.map.selectionChanged.subscribe(() => {
        this._cdr.detectChanges();
      });
      this.loadingState = 'success';
      this._cdr.detectChanges();
      console.log('Map created successfully');

    } catch (error) {
      console.log(error);
      this.loadingState = 'failed';
      this._cdr.detectChanges();
    }
  }

  ngOnDestroy() {
    this._selectionSub?.unsubscribe();
  }

  
}
