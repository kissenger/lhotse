import { ChangeDetectorRef, Component, HostListener, OnInit } from '@angular/core';
import { NgClass } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpService } from '@shared/services/http.service';
import { ToastService } from '@shared/services/toast.service';
import { OrgDiscover, OrgDocument, OrgGenerate, OrgListItem } from '@shared/types';
import { CanLeaveOrganisationsEditor } from './organisations-unsaved-changes.guard';

@Component({
  selector: 'app-organisations-editor',
  standalone: true,
  imports: [NgClass, FormsModule],
  templateUrl: './organisations-editor.component.html',
  styleUrl: './organisations-editor.component.css',
})
export class OrganisationsEditorComponent implements OnInit, CanLeaveOrganisationsEditor {

  listItems: OrgListItem[] = [];
  listTotal = 0;
  listSearch = '';
  listLoading = false;

  selectedDoc: OrgDocument | null = null;
  selectedId = '';
  isDirty = false;
  isSaving = false;

  scoringThreshold = 70;
  scoringThresholdDirty = false;

  askForConfirmation = false;
  askForOverwriteVerify = false;
  contentSource: 'generated' | 'favourite' = 'generated';
  tagInput = '';
  private _savedFavouriteSnapshot = '';

  readonly CATEGORIES = [
    'Authors of Snorkelling Britain',
    'Snorkelling Retailer',
    'Marine Interest Group',
    'Outdoor Activities Provider',
    'Snorkelling Club or School',
    'Snorkelling Guide or Tour Operator',
    'Snorkelling Information Resource',
    'Snorkelling Site',
  ];

  readonly TAGS = [
    'Boat Snorkelling',
    'Club Trips and Events',
    'Equipment Rental',
    'Equipment Sales',
    'Freediving',
    'Instructor (BSAC)',
    'Instructor (Other)',
    'Instructor (PADI)',
    'Instructor (SSI)',
    'Octopush (Underwater Hockey)',
    'Snorkel Tours/Safari/Guiding',
    'Snorkelling Information',
  ];

  constructor(
    private _http: HttpService,
    private _toaster: ToastService,
    private _cdr: ChangeDetectorRef,
  ) {}

  ngOnInit() {
    this.loadSettings();
    this.loadList();
  }

  // ---- list loading ----

  async loadSettings() {
    try {
      const s = await this._http.getOrgSettings();
      this.scoringThreshold = s.scoringThreshold;
    } catch {}
    this._cdr.detectChanges();
  }

  async onSaveThreshold() {
    try {
      const saved = await this._http.saveOrgSettings({ scoringThreshold: this.scoringThreshold });
      this.scoringThreshold = saved.scoringThreshold;
      this.scoringThresholdDirty = false;
      this._toaster.show('Threshold saved', 'success');
      await this.loadList();
    } catch {
      this._toaster.show('Failed to save threshold', 'error');
    }
    this._cdr.detectChanges();
  }

  async loadList() {
    this.listLoading = true;
    try {
      const res = await this._http.listOrgDocs('discover', this.listSearch, 0, 2000);
      this.listItems = res.docs;
      this.listTotal = res.total;
    } catch {
      this._toaster.show('Could not load records', 'error');
    } finally {
      this.listLoading = false;
      this._cdr.detectChanges();
    }
  }

  async onSearch() {
    await this.loadList();
  }

  // ---- record selection ----

  async onFormSelect(id: string) {
    if (!id) {
      this.selectedDoc = null;
      this.selectedId = '';
      this._savedFavouriteSnapshot = '';
      return;
    }
    this.selectedId = id;
    this.isDirty = false;
    this.askForConfirmation = false;
    this.askForOverwriteVerify = false;
    try {
      this.selectedDoc = await this._http.getOrgDoc('verify', id);
      const savedSource = this._fav['contentSource'];
      this.contentSource = savedSource === 'generated' || savedSource === 'favourite'
        ? savedSource
        : (this._fav['isFavourite'] ? 'favourite' : 'generated');
      this._takeFavouriteSnapshot();
      if (this._fav['isFavourite'] && this.verifiedDataEmpty) {
        this._doPopulate();
      }
    } catch {
      this._toaster.show('Could not load record', 'error');
    }
    this._cdr.detectChanges();
  }

  // ---- save ----

  async onSave() {
    if (!this.selectedDoc || !this.selectedId || this.isSaving) return;
    this._fav['contentSource'] = this.contentSource;
    this._fav['isFavourite'] = true;
    await this._doSave();
  }

  // ---- manual map override ----

  async onToggleManualPublish() {
    if (!this.selectedDoc || !this.selectedId || this.isSaving) return;
    const newVal = !this._fav['forcedPublish'];
    this._fav['forcedPublish'] = newVal || undefined;
    await this._doSave();
  }

  async onToggleSuppressOnMap() {
    if (!this.selectedDoc || !this.selectedId || this.isSaving) return;
    const newVal = !this._fav['suppressOnMap'];
    this._fav['suppressOnMap'] = newVal || undefined;
    await this._doSave();
  }

  async onToggleMapVisibility() {
    if (!this.selectedDoc || !this.selectedId || this.isSaving) return;
    const fav = this._fav;

    if (this.isOnMap) {
      fav['forcedPublish'] = undefined;
      fav['suppressOnMap'] = true;
    } else {
      fav['suppressOnMap'] = undefined;
      fav['forcedPublish'] = this.isAutoSelected ? undefined : true;
    }

    await this._doSave();
  }

  private async _doSave() {
    if (!this.selectedDoc || !this.selectedId || this.isSaving) return;
    this.isSaving = true;
    try {
      this.selectedDoc = await this._http.saveOrgDoc('verify', this.selectedId, this.selectedDoc);
      this.isDirty = false;
      this._takeFavouriteSnapshot();
      this._toaster.show('Saved', 'success');
      await this.loadList();
    } catch {
      this._toaster.show('Save failed', 'error');
    } finally {
      this.isSaving = false;
      this._cdr.detectChanges();
    }
  }

  // ---- delete ----

  onYesDelete(confirmed: boolean) {
    if (!confirmed) { this.askForConfirmation = true; return; }
    this.askForConfirmation = false;
    this._doDelete();
  }

  onNoDelete() { this.askForConfirmation = false; }

  private async _doDelete() {
    if (!this.selectedId) return;
    try {
      await this._http.deleteOrgDoc('verify', this.selectedId);
      this._toaster.show('Deleted', 'success');
      this.selectedDoc = null;
      this.selectedId = '';
      this._savedFavouriteSnapshot = '';
      this.isDirty = false;
      await this.loadList();
    } catch {
      this._toaster.show('Delete failed', 'error');
    }
    this._cdr.detectChanges();
  }

  // ---- typed doc accessors ----

  get asDiscover(): OrgDiscover             { return this.selectedDoc!.discover; }
  get asGenerate(): OrgGenerate | undefined  { return this.selectedDoc?.generate; }

  private get _fav(): any {
    if (!this.selectedDoc) return {};
    if (!this.selectedDoc.favourite) this.selectedDoc.favourite = {};
    return this.selectedDoc.favourite as any;
  }

  // ---- favourite-backed editor data helpers ----

  get verifiedData(): any {
    return this._fav;
  }

  @HostListener('window:beforeunload', ['$event'])
  onBeforeUnload(event: BeforeUnloadEvent) {
    if (!this.canLeavePage()) {
      event.preventDefault();
    }
  }

  canLeavePage(): boolean {
    if (this._hasIncompleteFavouriteSelection()) {
      alert('Favourite content source requires Favourite Description, Category, and at least one Tag before leaving this page.');
      return false;
    }
    if (this._hasUnsavedFavouriteChanges()) {
      alert('You have unsaved changes in Favourite data. Please save before leaving this page.');
      return false;
    }
    return true;
  }

  get verifiedDataEmpty(): boolean {
    const vd = this.selectedDoc?.favourite as any;
    if (!vd) return true;
    const c = (vd['contacts'] ?? vd['socialLinks']);
    const hasContacts = !!(c && (c.website || c.phone || c.email || c.facebook || c.instagram || c.youtube));
    return !vd['description'] && (!vd['tags'] || !vd['tags'].length) && !vd['category'] && !vd['name'] && !vd['localityOverride'] && !hasContacts;
  }

  get verifiedContacts(): any {
    const vd = this.verifiedData;
    if (!vd.contacts) vd.contacts = {};
    return vd.contacts;
  }

  get isOnMap(): boolean {
    if (!this.selectedDoc) return false;
    if (this._fav['suppressOnMap']) return false;
    if (this._fav['forcedPublish']) return true;
    if (this._fav['isFavourite']) return true;
    const score = this.selectedDoc.generate?.rank?.rank_score;
    const britishPass = this.selectedDoc.generate?.rank?.british_operations_pass === true;
    const activePass = this.selectedDoc.generate?.rank?.active_presence_pass === true;
    return score != null && score >= this.scoringThreshold && britishPass && activePass;
  }

  get isAutoSelected(): boolean {
    if (!this.selectedDoc) return false;
    if (this._fav['isFavourite']) return true;
    const score = this.selectedDoc.generate?.rank?.rank_score;
    const britishPass = this.selectedDoc.generate?.rank?.british_operations_pass === true;
    const activePass = this.selectedDoc.generate?.rank?.active_presence_pass === true;
    return score != null && score >= this.scoringThreshold && britishPass && activePass;
  }

  get mapToggleLabel(): string {
    return this.isOnMap ? 'Remove from map' : 'Add to map';
  }

  get isForcedPublished(): boolean {
    return !!this._fav['forcedPublish'];
  }

  get isSuppressedFromMap(): boolean {
    return !!this._fav['suppressOnMap'];
  }

  get isFavouriteVerified(): boolean {
    return !!this._fav['verified'];
  }

  get britishOperationsStatus(): 'pass' | 'fail' | 'unknown' {
    const v = this.selectedDoc?.generate?.rank?.british_operations_pass;
    if (v === true) return 'pass';
    if (v === false) return 'fail';
    return 'unknown';
  }

  get activePresenceStatus(): 'pass' | 'fail' | 'unknown' {
    const v = this.selectedDoc?.generate?.rank?.active_presence_pass;
    if (v === true) return 'pass';
    if (v === false) return 'fail';
    return 'unknown';
  }

  requestContentSource(source: 'generated' | 'favourite') {
    if (source === this.contentSource) return;
    if (source === 'generated') {
      if (!this.selectedDoc) return;
      this.contentSource = 'generated';
      this._fav['contentSource'] = this.contentSource;
      this.isDirty = true;
      return;
    }
    if (!this.selectedDoc) return;
    this.contentSource = source;
    this._fav['contentSource'] = this.contentSource;
    this.isDirty = true;
  }

  populateFromGenerate() {
    if (!this.selectedDoc) return;
    if (!this.verifiedDataEmpty) {
      this.askForOverwriteVerify = true;
      return;
    }
    this._doPopulate();
  }

  confirmOverwrite() {
    this.askForOverwriteVerify = false;
    this._doPopulate();
  }

  cancelOverwrite() {
    this.askForOverwriteVerify = false;
  }

  private _doPopulate() {
    if (!this.selectedDoc) return;
    const favourite = this._fav;
    const gc: any = this.selectedDoc.generate?.content;
    const sl: any = this.selectedDoc.generate?.rank?.socialLinks;
    const fav: any = favourite;
    const discover: any = this.selectedDoc.discover;
    const favSocial: any = fav?.socialLinks ?? fav?.contacts ?? {};

    const fromCsv = (v: unknown): string[] => {
      if (typeof v !== 'string') return [];
      return v.split(',').map(s => s.trim()).filter(Boolean);
    };
    const toStringArray = (v: unknown): string[] => {
      if (Array.isArray(v)) return v.map(x => String(x).trim()).filter(Boolean);
      if (typeof v === 'string') return fromCsv(v);
      return [];
    };
    const firstNonEmpty = (...vals: unknown[]): string => {
      for (const v of vals) {
        if (typeof v === 'string' && v.trim()) return v.trim();
      }
      return '';
    };
    const preferFavourite = this.contentSource === 'favourite' && fav?.isFavourite === true;

    const description = preferFavourite
      ? firstNonEmpty(fav?.description, gc?.description)
      : firstNonEmpty(gc?.description, fav?.description);

    const generateTags = toStringArray(gc?.tags);
    const favouriteTags = toStringArray(fav?.tags).length ? toStringArray(fav?.tags) : toStringArray(fav?.keywords);
    const tags = preferFavourite
      ? (favouriteTags.length ? favouriteTags : generateTags)
      : (generateTags.length ? generateTags : favouriteTags);

    const category = preferFavourite
      ? firstNonEmpty(fav?.category, fav?.categoryName, gc?.category, discover?.categoryName)
      : firstNonEmpty(gc?.category, fav?.category, fav?.categoryName, discover?.categoryName);
    const name = preferFavourite
      ? firstNonEmpty(fav?.name, gc?.name, discover?.title)
      : firstNonEmpty(gc?.name, fav?.name, discover?.title);

    const website = preferFavourite
      ? firstNonEmpty(favSocial?.website, fav?.website, sl?.website, discover?.website)
      : firstNonEmpty(sl?.website, favSocial?.website, fav?.website, discover?.website);
    const phone = preferFavourite
      ? firstNonEmpty(favSocial?.phones?.[0], favSocial?.phone, fav?.phone, sl?.phones?.[0], discover?.phone)
      : firstNonEmpty(sl?.phones?.[0], favSocial?.phones?.[0], favSocial?.phone, fav?.phone, discover?.phone);
    const email = preferFavourite
      ? firstNonEmpty(favSocial?.emails?.[0], favSocial?.email, fav?.email, sl?.emails?.[0])
      : firstNonEmpty(sl?.emails?.[0], favSocial?.emails?.[0], favSocial?.email, fav?.email);
    const facebook = preferFavourite
      ? firstNonEmpty(favSocial?.facebook, fav?.facebook, sl?.facebook)
      : firstNonEmpty(sl?.facebook, favSocial?.facebook, fav?.facebook);
    const instagram = preferFavourite
      ? firstNonEmpty(favSocial?.instagram, fav?.instagram, sl?.instagram)
      : firstNonEmpty(sl?.instagram, favSocial?.instagram, fav?.instagram);
    const youtube = preferFavourite
      ? firstNonEmpty(favSocial?.youtube, fav?.youtube, sl?.youtube)
      : firstNonEmpty(sl?.youtube, favSocial?.youtube, fav?.youtube);

    favourite['description'] = description || undefined;
    favourite['tags'] = [...tags];
    favourite['category'] = category || undefined;
    favourite['name'] = name || undefined;
    if (!favourite['contacts']) favourite['contacts'] = {};
    favourite['contacts'].website = website || undefined;
    favourite['contacts'].phone = phone || undefined;
    favourite['contacts'].email = email || undefined;
    favourite['contacts'].facebook = facebook || undefined;
    favourite['contacts'].instagram = instagram || undefined;
    favourite['contacts'].youtube = youtube || undefined;
    this.isDirty = true;
    this._cdr.detectChanges();
  }

  // ---- tag helpers ----

  removeVerifiedTag(tag: string) {
    const vd = this.verifiedData;
    vd.tags = (vd.tags ?? []).filter((t: string) => t !== tag);
    this.isDirty = true;
  }

  addVerifiedTag() {
    const tag = this.tagInput.trim();
    if (!tag) return;
    const vd = this.verifiedData;
    if (!vd.tags) vd.tags = [];
    if (!vd.tags.includes(tag)) {
      vd.tags.push(tag);
      this.isDirty = true;
    }
    this.tagInput = '';
  }

  onTagSelected(tag: string) {
    this.tagInput = (tag ?? '').trim();
    if (!this.tagInput) return;
    this.addVerifiedTag();
  }

  get availableTags(): string[] {
    const applied = new Set(this.verifiedData?.tags ?? []);
    return this.TAGS.filter(t => !applied.has(t));
  }

  get uniqueGroundingSources(): string[] {
    const sources = this.selectedDoc?.generate?.content?.grounding_sources ?? [];
    const website = this.selectedDoc?.discover?.website;
    const seen = new Set<string>(website ? [website] : []);
    return sources.filter(s => { if (seen.has(s)) return false; seen.add(s); return true; });
  }

  get sortedListItems(): OrgListItem[] {
    return [...this.listItems].sort((a, b) => (b.rank_score ?? -Infinity) - (a.rank_score ?? -Infinity));
  }

  get totalSitesInDb(): number {
    return this.listTotal;
  }

  get criteriaMatchedCount(): number {
    return this.listItems.filter(item => {
      const score = item.rank_score;
      const britishPass = item.british_operations_pass === true;
      const activePass = item.active_presence_pass === true;
      return score != null && score >= this.scoringThreshold && britishPass && activePass;
    }).length;
  }

  get shownOnMapCount(): number {
    return this.listItems.filter(item => item.isOnMap === true).length;
  }

  getMapStatusSymbolPrefix(item: OrgListItem): string {
    if (item.isSuppressed) return '❌ ';
    if (item.isOnMap) return '✅ ';
    return '';
  }

  get flaggedForUpdate(): boolean { return false; }
  set flaggedForUpdate(_val: boolean) { /* field removed from schema */ }

  get newContentAvailable(): boolean { return false; }
  set newContentAvailable(_val: boolean) { /* field removed from schema */ }

  get hasLocation(): boolean {
    const loc = this.selectedDoc?.discover?.location as any;
    const coords = loc?.coordinates;
    return Array.isArray(coords) && coords.length >= 2 && (coords[0] !== 0 || coords[1] !== 0);
  }

  get locationLng(): string {
    const coords = (this.selectedDoc?.discover?.location as any)?.coordinates;
    return coords?.[0] != null ? String(coords[0]) : '';
  }
  set locationLng(val: string) {
    if (!this.selectedDoc) return;
    const n = parseFloat(val);
    const d = this.selectedDoc.discover as any;
    if (!d.location) d.location = { type: 'Point', coordinates: [0, 0] };
    d.location.coordinates[0] = isNaN(n) ? 0 : n;
  }

  get locationLat(): string {
    const coords = (this.selectedDoc?.discover?.location as any)?.coordinates;
    return coords?.[1] != null ? String(coords[1]) : '';
  }
  set locationLat(val: string) {
    if (!this.selectedDoc) return;
    const n = parseFloat(val);
    const d = this.selectedDoc.discover as any;
    if (!d.location) d.location = { type: 'Point', coordinates: [0, 0] };
    d.location.coordinates[1] = isNaN(n) ? 0 : n;
  }

  get criterionScoreEntries(): { key: string; score: number; rationale?: string }[] {
    const scores = this.selectedDoc?.generate?.rank?.criterion_scores;
    const rationale = this.selectedDoc?.generate?.rank?.criterion_rationale;
    if (!scores) return [];
    return Object.entries(scores).map(([key, score]) => ({
      key,
      score,
      rationale: rationale?.[key],
    }));
  }

  // ---- reverse_geo accessors ----

  private get _rgCtx(): any {
    return this.selectedDoc?.reverse_geo?.properties?.context ?? {};
  }

  get rgPlace():    string { return this._rgCtx.place?.name    ?? ''; }
  get rgDistrict(): string { return this._rgCtx.district?.name ?? ''; }
  get rgRegion():   string { return this._rgCtx.region?.name   ?? ''; }
  get rgCountry():  string { return this._rgCtx.country?.name  ?? ''; }
  get rgPostcode(): string { return this._rgCtx.postcode?.name ?? ''; }
  get rgAddress():  string { return this.selectedDoc?.reverse_geo?.properties?.full_address ?? ''; }
  get hasReverseGeo(): boolean { return !!this.selectedDoc?.reverse_geo; }

  private _takeFavouriteSnapshot() {
    this._savedFavouriteSnapshot = JSON.stringify(this.selectedDoc?.favourite ?? {});
  }

  private _hasUnsavedFavouriteChanges(): boolean {
    if (!this.selectedDoc) return false;
    return JSON.stringify(this.selectedDoc.favourite ?? {}) !== this._savedFavouriteSnapshot;
  }

  private _hasIncompleteFavouriteSelection(): boolean {
    if (!this.selectedDoc || this.contentSource !== 'favourite') return false;
    const fav = (this.selectedDoc.favourite ?? {}) as any;
    const hasDescription = typeof fav.description === 'string' && fav.description.trim().length > 0;
    const hasCategory = typeof fav.category === 'string' && fav.category.trim().length > 0;
    const hasTags = Array.isArray(fav.tags) && fav.tags.some((t: unknown) => typeof t === 'string' && t.trim().length > 0);
    return !hasDescription || !hasCategory || !hasTags;
  }
}
