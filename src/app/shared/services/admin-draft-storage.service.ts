import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

@Injectable({ providedIn: 'root' })
export class AdminDraftStorageService {
  private readonly STORAGE_PREFIX = 'admin-draft:';

  constructor(@Inject(PLATFORM_ID) private readonly _platformId: object) {}

  saveDraft<T>(scope: string, value: T): void {
    if (!this._canUseStorage()) {
      return;
    }

    const payload = JSON.stringify({ value, savedAt: Date.now() });
    localStorage.setItem(this._storageKey(scope), payload);
  }

  loadDraft<T>(scope: string): T | null {
    if (!this._canUseStorage()) {
      return null;
    }

    const raw = localStorage.getItem(this._storageKey(scope));
    if (!raw) {
      return null;
    }

    try {
      const parsed = JSON.parse(raw) as { value?: T; savedAt?: number };
      return parsed.value ?? null;
    } catch {
      return null;
    }
  }

  clearDraft(scope: string): void {
    if (!this._canUseStorage()) {
      return;
    }

    localStorage.removeItem(this._storageKey(scope));
  }

  private _storageKey(scope: string): string {
    return `${this.STORAGE_PREFIX}${scope}`;
  }

  private _canUseStorage(): boolean {
    return isPlatformBrowser(this._platformId) && typeof localStorage !== 'undefined';
  }
}
