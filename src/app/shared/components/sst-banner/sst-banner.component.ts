import { isPlatformBrowser } from '@angular/common';
import { Component, ElementRef, Inject, OnDestroy, OnInit, PLATFORM_ID, ViewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { HttpService } from '@shared/services/http.service';
import { CurrentTemperatureSummary } from '@shared/types';

const REVEAL_DELAY_MS = 1000;
const HEIGHT_VAR = '--sst-banner-height';

@Component({
  selector: 'app-sst-banner',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './sst-banner.component.html',
  styleUrl: './sst-banner.component.css',
})
export class SstBannerComponent implements OnInit, OnDestroy {
  summary: CurrentTemperatureSummary | null = null;
  dismissed = false;
  visible = false;

  @ViewChild('inner') private inner?: ElementRef<HTMLElement>;

  private revealTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    @Inject(PLATFORM_ID) private readonly platformId: object,
    private readonly http: HttpService,
  ) {}

  ngOnInit(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    void this.loadSummary();
  }

  ngOnDestroy(): void {
    if (this.revealTimer !== null) clearTimeout(this.revealTimer);
    this.setReservedHeight(0);
  }

  dismiss(): void {
    this.dismissed = true;
    this.setReservedHeight(0);
  }

  // The banner is fixed-positioned, so page content is offset via this variable instead.
  private setReservedHeight(pixels: number): void {
    if (!isPlatformBrowser(this.platformId)) return;
    document.documentElement.style.setProperty(HEIGHT_VAR, `${pixels}px`);
  }

  get temperature(): string {
    return this.summary?.temperatureC.toFixed(1) ?? '';
  }

  get deviation(): string {
    return Math.abs(this.summary?.deviationC ?? 0).toFixed(1);
  }

  get comparison(): string {
    const deviation = this.summary?.deviationC ?? 0;
    if (Math.abs(deviation) < 0.05) return 'in line with';
    return deviation > 0 ? 'above' : 'below';
  }

  get observationDate(): string {
    if (!this.summary) return '';
    return new Intl.DateTimeFormat('en-GB', {
      day: 'numeric',
      month: 'long',
      timeZone: 'UTC',
    }).format(new Date(`${this.summary.observationDate}T00:00:00Z`));
  }

  private async loadSummary(): Promise<void> {
    try {
      const summary = await this.http.getCurrentTemperature();
      this.summary = this.isUsableSummary(summary) ? summary : null;
    } catch {
      this.summary = null;
    }

    if (this.summary) this.scheduleReveal();
  }

  private scheduleReveal(): void {
    this.revealTimer = setTimeout(() => {
      this.revealTimer = null;
      this.visible = true;
      this.setReservedHeight(this.inner?.nativeElement.offsetHeight ?? 0);
    }, REVEAL_DELAY_MS);
  }

  private isUsableSummary(summary: CurrentTemperatureSummary): boolean {
    const observationTime = Date.parse(`${summary.observationDate}T00:00:00Z`);
    return summary.schemaVersion === 1
      && Number.isFinite(summary.temperatureC)
      && Number.isFinite(summary.baselineTemperatureC)
      && Number.isFinite(summary.deviationC)
      && Number.isInteger(summary.baselineStartYear)
      && Number.isInteger(summary.baselineEndYear)
      && Number.isFinite(observationTime);
  }
}