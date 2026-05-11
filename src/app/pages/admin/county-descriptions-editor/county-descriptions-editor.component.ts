import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgClass } from '@angular/common';
import { HttpService } from '@shared/services/http.service';
import { getCountyDisplayName, normaliseCountySegment, slugifyMapSegment } from '@shared/map-paths';
import { CountyDescriptionAdminItem, CountryDescriptionAdminItem } from '@shared/types';

@Component({
  selector: 'app-county-descriptions-editor',
  standalone: true,
  imports: [FormsModule, NgClass],
  templateUrl: './county-descriptions-editor.component.html',
  styleUrl: './county-descriptions-editor.component.css'
})
export class CountyDescriptionsEditorComponent implements OnInit {

  // County
  countyItems: CountyDescriptionAdminItem[] = [];
  filteredItems: CountyDescriptionAdminItem[] = [];
  selectedCountyName = '';
  countyDescription = '';
  search = '';
  isSaving = false;
  isDeleting = false;
  feedback = '';

  // Country
  countryItems: CountryDescriptionAdminItem[] = [];
  filteredCountryItems: CountryDescriptionAdminItem[] = [];
  selectedCountryName = '';
  countryDescription = '';
  countrySearch = '';
  isCountrySaving = false;
  isCountryDeleting = false;
  countryFeedback = '';

  constructor(private _http: HttpService) {}

  async ngOnInit() {
    await Promise.all([this.load(), this.loadCountries()]);
  }

  // --- County ---

  async load() {
    this.feedback = '';
    this.countyItems = this._mergeCanonicalCountyItems(await this._http.getCountiesAdmin());
    this.applyFilter();
  }

  private _mergeCanonicalCountyItems(items: CountyDescriptionAdminItem[]): CountyDescriptionAdminItem[] {
    const merged = new Map<string, CountyDescriptionAdminItem>();

    for (const item of items) {
      const fallbackSlug = slugifyMapSegment(item.countyName ?? '');
      const sourceSlug = item.countySlug || fallbackSlug;
      const canonicalSlug = normaliseCountySegment(sourceSlug) ?? sourceSlug;
      if (!canonicalSlug) continue;

      const current = merged.get(canonicalSlug);
      const description = (item.description ?? '').trim();

      if (!current) {
        merged.set(canonicalSlug, {
          _id: item._id,
          countySlug: canonicalSlug,
          countyName: getCountyDisplayName(canonicalSlug),
          description: item.description ?? '',
        });
        continue;
      }

      if (!current._id && item._id) {
        current._id = item._id;
      }

      if (!current.description?.trim() && description) {
        current.description = item.description ?? '';
      }
    }

    return [...merged.values()].sort((a, b) => a.countyName.localeCompare(b.countyName));
  }

  applyFilter() {
    const q = this.search.trim().toLowerCase();
    this.filteredItems = this.countyItems.filter((c) => {
      if (!q) return true;
      return (
        c.countyName.toLowerCase().includes(q) ||
        c.countySlug.toLowerCase().includes(q) ||
        (c.description || '').toLowerCase().includes(q)
      );
    });
  }

  onCountySelect(countyName: string) {
    this.selectedCountyName = countyName;
    const match = this.countyItems.find((c) => c.countyName === countyName);
    this.countyDescription = match?.description || '';
    this.feedback = '';
  }

  onNew() {
    this.selectedCountyName = '';
    this.countyDescription = '';
    this.feedback = '';
  }

  async onSave() {
    const countyName = this.selectedCountyName.trim();
    if (!countyName) { this.feedback = 'Select a county first.'; return; }
    this.isSaving = true;
    this.feedback = '';
    try {
      await this._http.upsertCountyDescription({ countyName, description: this.countyDescription || '' });
      await this.load();
      this.onCountySelect(countyName);
      this.feedback = 'Saved.';
    } finally {
      this.isSaving = false;
    }
  }

  async onDelete() {
    const countyName = this.selectedCountyName.trim();
    if (!countyName) { this.feedback = 'Select a county first.'; return; }
    const item = this.countyItems.find((c) => c.countyName === countyName);
    if (!item?._id) { this.feedback = 'No saved description exists for this county.'; return; }
    this.isDeleting = true;
    this.feedback = '';
    try {
      await this._http.deleteCountyDescription(item._id);
      await this.load();
      this.onCountySelect(countyName);
      this.feedback = 'Deleted.';
    } finally {
      this.isDeleting = false;
    }
  }

  // --- Country ---

  async loadCountries() {
    this.countryFeedback = '';
    this.countryItems = await this._http.getCountriesAdmin();
    this.applyCountryFilter();
  }

  applyCountryFilter() {
    const q = this.countrySearch.trim().toLowerCase();
    this.filteredCountryItems = this.countryItems.filter((c) => {
      if (!q) return true;
      return (
        c.countryName.toLowerCase().includes(q) ||
        c.countrySlug.toLowerCase().includes(q) ||
        (c.description || '').toLowerCase().includes(q)
      );
    });
  }

  onCountrySelect(countryName: string) {
    this.selectedCountryName = countryName;
    const match = this.countryItems.find((c) => c.countryName === countryName);
    this.countryDescription = match?.description || '';
    this.countryFeedback = '';
  }

  onCountryNew() {
    this.selectedCountryName = '';
    this.countryDescription = '';
    this.countryFeedback = '';
  }

  async onCountrySave() {
    const countryName = this.selectedCountryName.trim();
    if (!countryName) { this.countryFeedback = 'Enter a country name first.'; return; }
    this.isCountrySaving = true;
    this.countryFeedback = '';
    try {
      await this._http.upsertCountryDescription({ countryName, description: this.countryDescription || '' });
      await this.loadCountries();
      this.onCountrySelect(countryName);
      this.countryFeedback = 'Saved.';
    } finally {
      this.isCountrySaving = false;
    }
  }

  async onCountryDelete() {
    const countryName = this.selectedCountryName.trim();
    if (!countryName) { this.countryFeedback = 'Select a country first.'; return; }
    const item = this.countryItems.find((c) => c.countryName === countryName);
    if (!item?._id) { this.countryFeedback = 'No saved description exists for this country.'; return; }
    this.isCountryDeleting = true;
    this.countryFeedback = '';
    try {
      await this._http.deleteCountryDescription(item._id);
      await this.loadCountries();
      this.onCountrySelect(countryName);
      this.countryFeedback = 'Deleted.';
    } finally {
      this.isCountryDeleting = false;
    }
  }
}
