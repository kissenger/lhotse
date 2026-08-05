import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { HttpService } from '@shared/services/http.service';
import { ToastService } from '@shared/services/toast.service';
import { ShopOutOfOfficeAdminSettings } from '@shared/types';

@Component({
  selector: 'app-shop-settings',
  standalone: true,
  imports: [FormsModule, DatePipe, RouterLink],
  templateUrl: './shop-settings.component.html',
  styleUrl: './shop-settings.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ShopSettingsComponent {
  public outOfOfficeMessage = '';
  public outOfOfficeEndDate = '';
  public outOfOfficeActive = false;
  public outOfOfficeEffectiveEndDate: string | null = null;
  public shopSettingsLoading = false;
  public shopSettingsSaving = false;

  constructor(
    private _http: HttpService,
    private _toaster: ToastService,
    private _cdr: ChangeDetectorRef,
  ) {}

  ngOnInit() {
    void this.loadShopSettings();
  }

  private _applyShopSettings(settings: ShopOutOfOfficeAdminSettings) {
    this.outOfOfficeMessage = settings.rawMessage;
    this.outOfOfficeEndDate = settings.rawEndDate ?? '';
    this.outOfOfficeActive = settings.active;
    this.outOfOfficeEffectiveEndDate = settings.endDate;
  }

  async loadShopSettings() {
    this.shopSettingsLoading = true;
    try {
      this._applyShopSettings(await this._http.getAdminShopSettings());
    } catch {
      this._applyShopSettings({ active: false, message: '', endDate: null, rawMessage: '', rawEndDate: null });
    } finally {
      this.shopSettingsLoading = false;
      this._cdr.markForCheck();
    }
  }

  async saveShopSettings() {
    if (this.shopSettingsSaving) return;

    const trimmedMessage = this.outOfOfficeMessage.trim();
    const rawEndDate = this.outOfOfficeEndDate || null;

    if (!trimmedMessage && this.outOfOfficeEndDate) {
      this._toaster.show('Add a message before setting an end date', 'warning');
      return;
    }

    if (trimmedMessage && !this.outOfOfficeEndDate) {
      this._toaster.show('Add an end date before saving the message', 'warning');
      return;
    }

    if (rawEndDate && !/^\d{4}-\d{2}-\d{2}$/.test(rawEndDate)) {
      this._toaster.show('Choose a valid end date', 'warning');
      return;
    }

    this.shopSettingsSaving = true;
    try {
      const saved = await this._http.saveAdminShopSettings({
        rawMessage: trimmedMessage,
        rawEndDate,
      });
      this._applyShopSettings(saved);
      this._toaster.show(trimmedMessage ? 'Checkout notice saved' : 'Checkout notice cleared', 'success');
    } catch (error: any) {
      this._toaster.show(error?.error?.message || 'Failed to save checkout notice', 'error');
    } finally {
      this.shopSettingsSaving = false;
      this._cdr.markForCheck();
    }
  }

  async clearShopSettings() {
    this.outOfOfficeMessage = '';
    this.outOfOfficeEndDate = '';
    await this.saveShopSettings();
  }
}