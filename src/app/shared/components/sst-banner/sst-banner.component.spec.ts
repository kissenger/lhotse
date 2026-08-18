import { PLATFORM_ID } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { HttpService } from '@shared/services/http.service';
import { CurrentTemperatureSummary } from '@shared/types';
import { SstBannerComponent } from './sst-banner.component';

function currentSummary(overrides: Partial<CurrentTemperatureSummary> = {}): CurrentTemperatureSummary {
  return {
    schemaVersion: 1,
    observationDate: new Date().toISOString().slice(0, 10),
    generatedAt: new Date().toISOString(),
    temperatureC: 15.42,
    baselineTemperatureC: 14.18,
    deviationC: 1.24,
    baselineStartYear: 1982,
    baselineEndYear: 2011,
    ...overrides,
  };
}

describe('SstBannerComponent', () => {
  let fixture: ComponentFixture<SstBannerComponent>;
  let getCurrentTemperature: jasmine.Spy;

  beforeEach(async () => {
    getCurrentTemperature = jasmine.createSpy('getCurrentTemperature');
    await TestBed.configureTestingModule({
      imports: [SstBannerComponent],
      providers: [
        provideRouter([]),
        { provide: PLATFORM_ID, useValue: 'browser' },
        { provide: HttpService, useValue: { getCurrentTemperature } },
      ],
    }).compileComponents();
  });

  it('renders fresh temperature data and the article link', async () => {
    getCurrentTemperature.and.resolveTo(currentSummary());
    fixture = TestBed.createComponent(SstBannerComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;
    expect(element.textContent).toContain('15.4 °C');
    expect(element.textContent).toContain('1.2 °C above');
    expect(element.querySelector('a')?.getAttribute('href'))
      .toBe('/articles/britain-and-ireland-coastal-sea-temperature-trends');
  });

  it('removes the banner for the current component load when dismissed', async () => {
    getCurrentTemperature.and.resolveTo(currentSummary());
    fixture = TestBed.createComponent(SstBannerComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('button')?.click();
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).querySelector('.sst-banner')).toBeNull();
  });

  it('stays hidden when the endpoint fails', async () => {
    getCurrentTemperature.and.rejectWith(new Error('unavailable'));
    fixture = TestBed.createComponent(SstBannerComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).querySelector('.sst-banner')).toBeNull();
  });

  it('renders an old observation when its data is valid', async () => {
    getCurrentTemperature.and.resolveTo(currentSummary({ observationDate: '2020-01-01' }));
    fixture = TestBed.createComponent(SstBannerComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('1 January');
  });

  it('stays hidden when the observation date is invalid', async () => {
    getCurrentTemperature.and.resolveTo(currentSummary({ observationDate: 'not-a-date' }));
    fixture = TestBed.createComponent(SstBannerComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).querySelector('.sst-banner')).toBeNull();
  });

  it('reveals the banner one second after the summary loads', async () => {
    jasmine.clock().install();
    getCurrentTemperature.and.resolveTo(currentSummary());
    fixture = TestBed.createComponent(SstBannerComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const banner = () => (fixture.nativeElement as HTMLElement).querySelector('.sst-banner');
    expect(banner()?.classList.contains('sst-banner--visible')).toBe(false);

    jasmine.clock().tick(1000);
    fixture.detectChanges();
    expect(banner()?.classList.contains('sst-banner--visible')).toBe(true);
    jasmine.clock().uninstall();
  });
});
