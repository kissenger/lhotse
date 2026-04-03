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
  selector: 'app-map',
  templateUrl: './map.component.html',
  styleUrls: ['./map.component.css'],
})

export class MapComponent implements AfterViewInit, OnDestroy {

  public geoJson: any = null;
  public loadingState: 'loading' | 'failed' | 'success' = 'loading';
  public map?: MapService;
  private _selectionSub?: import('rxjs').Subscription;

  filterOpen = false;
  snorkellingSitesEnabled = true;
  otherSitesEnabled = true;
  snorkellingCategories: { name: string; enabled: boolean }[] = [];
  otherCategories: { name: string; enabled: boolean }[] = [];

  constructor(
    private _lazyServiceInjector: LazyServiceInjector,    
    private _http: HttpService,
    private _cdr: ChangeDetectorRef
  ) {}

  async ngAfterViewInit() {
  
    try {
      const visibility = environment.STAGE === 'prod' ? ['Production'] : ['Production', 'Development']
      const result = await Promise.race([
        this._http.getSites(visibility),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), 15000))
      ]);
      this.geoJson = result;
      this.map = await this._lazyServiceInjector.get<MapService>(() =>
        import('@shared/services/map.service').then((m) => m.MapService)
      );
      await this.map.create(this.geoJson);
      this._buildCategoryLists();

      // Wire filter button injected by MapService IControl
      this.map.filterContainer?.querySelector('.filter-btn')
        ?.addEventListener('click', () => {
          this.filterOpen = !this.filterOpen;
          this._cdr.detectChanges();
        });

      // React to selection changes coming from MapService (mapbox events)
      this._selectionSub = this.map.selectionChanged.subscribe(() => {
        this._cdr.detectChanges();
      });
      this.loadingState = 'success';
      this._cdr.detectChanges();

    } catch (error) {
      this.loadingState = 'failed';
      this._cdr.detectChanges();
    }
  }

  ngOnDestroy() {
    this._selectionSub?.unsubscribe();
  }

  async onRetry() {
    this.loadingState = 'loading';
    this._cdr.detectChanges();
    await this.ngAfterViewInit();
  }

  private _buildCategoryLists() {
    const snorkCats = new Set<string>();
    const otherCats = new Set<string>();
    for (const feature of this.geoJson.features) {
      const props = feature.properties;
      const cats: string[] = props.categories ?? [];
      const isSnorkelling = props.featureType === 'Snorkelling Site';
      for (const c of cats) {
        (isSnorkelling ? snorkCats : otherCats).add(c);
      }
    }
    this.snorkellingCategories = [...snorkCats].sort().map(name => ({ name, enabled: true }));
    this.otherCategories = [...otherCats].sort().map(name => ({ name, enabled: true }));
  }

  toggleGroup(group: 'snorkelling' | 'other') {
    if (group === 'snorkelling') {
      this.snorkellingSitesEnabled = !this.snorkellingSitesEnabled;
      this.snorkellingCategories.forEach(c => c.enabled = this.snorkellingSitesEnabled);
    } else {
      this.otherSitesEnabled = !this.otherSitesEnabled;
      this.otherCategories.forEach(c => c.enabled = this.otherSitesEnabled);
    }
    this._applyFilter();
  }

  toggleCategory(cat: { name: string; enabled: boolean }, group: 'snorkelling' | 'other') {
    cat.enabled = !cat.enabled;
    const cats = group === 'snorkelling' ? this.snorkellingCategories : this.otherCategories;
    const anyEnabled = cats.some(c => c.enabled);
    if (group === 'snorkelling') this.snorkellingSitesEnabled = anyEnabled;
    else this.otherSitesEnabled = anyEnabled;
    this._applyFilter();
  }

  private _applyFilter() {
    if (!this.map || !this.geoJson) return;

    const allEnabled =
      this.snorkellingCategories.every(c => c.enabled) &&
      this.otherCategories.every(c => c.enabled);

    if (this.map.selectedFeature) this.map.clearSelection();

    if (allEnabled) {
      this.map.updateSourceData(this.geoJson);
      return;
    }

    const enabledSnorkCats = new Set(this.snorkellingCategories.filter(c => c.enabled).map(c => c.name));
    const enabledOtherCats = new Set(this.otherCategories.filter(c => c.enabled).map(c => c.name));

    const filtered = {
      ...this.geoJson,
      features: this.geoJson.features.filter((f: any) => {
        const isSnorkelling = f.properties.featureType === 'Snorkelling Site';
        const groupEnabled = isSnorkelling ? this.snorkellingSitesEnabled : this.otherSitesEnabled;
        if (!groupEnabled) return false;
        const cats: string[] = f.properties.categories ?? [];
        if (cats.length === 0) return true;
        const enabledCats = isSnorkelling ? enabledSnorkCats : enabledOtherCats;
        return cats.some((c: string) => enabledCats.has(c));
      }),
    };

    this.map.updateSourceData(filtered);
  }

  
}
