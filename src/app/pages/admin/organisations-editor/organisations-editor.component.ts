import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { NgClass } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpService } from '@shared/services/http.service';
import { ToastService } from '@shared/services/toast.service';
import { OrgDiscover, OrgDocument, OrgGenerate, OrgListItem, OrgVerify } from '@shared/types';

@Component({
  selector: 'app-organisations-editor',
  standalone: true,
  imports: [NgClass, FormsModule],
  templateUrl: './organisations-editor.component.html',
  styleUrl: './organisations-editor.component.css',
})
export class OrganisationsEditorComponent implements OnInit {

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
  askForClearVerified = false;
  tagInput = '';

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
      const res = await this._http.listOrgDocs('verify', this.listSearch, 0, 2000);
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
    if (!id) { this.selectedDoc = null; this.selectedId = ''; return; }
    this.selectedId = id;
    this.isDirty = false;
    this.askForConfirmation = false;
    this.askForOverwriteVerify = false;
    try {
      this.selectedDoc = await this._http.getOrgDoc('verify', id);
      if (!this.selectedDoc.verify) this.selectedDoc.verify = {} as OrgVerify;
      if (!this.selectedDoc.verify.verifiedData) this.selectedDoc.verify.verifiedData = {};
    } catch {
      this._toaster.show('Could not load record', 'error');
    }
    this._cdr.detectChanges();
  }

  // ---- save & verify ----

  async onSave() {
    if (!this.selectedDoc || !this.selectedId || this.isSaving) return;
    if (!this.selectedDoc.verify) this.selectedDoc.verify = {} as OrgVerify;
    this.selectedDoc.verify.verified = true;
    this.selectedDoc.verify.verifiedAt = new Date().toISOString();
    this.selectedDoc.verify.newContentPendingVerification = false;
    await this._doSave();
  }

  async onClearVerified() {
    if (!this.selectedDoc || !this.selectedId || this.isSaving) return;
    if (!this.selectedDoc.verify) this.selectedDoc.verify = {} as OrgVerify;
    this.selectedDoc.verify.verified = false;
    this.selectedDoc.verify.verifiedAt = undefined;
    this.selectedDoc.verify.verifiedData = undefined;
    this.askForClearVerified = false;
    await this._doSave();
  }

  // ---- manual map override ----

  async onToggleManualPublish() {
    if (!this.selectedDoc || !this.selectedId || this.isSaving) return;
    if (!this.selectedDoc.verify) this.selectedDoc.verify = {} as OrgVerify;
    const newVal = !this.selectedDoc.verify.forcedPublish;
    this.selectedDoc.verify.forcedPublish = newVal || undefined;
    await this._doSave();
  }

  async onToggleSuppressOnMap() {
    if (!this.selectedDoc || !this.selectedId || this.isSaving) return;
    if (!this.selectedDoc.verify) this.selectedDoc.verify = {} as OrgVerify;
    const newVal = !this.selectedDoc.verify.suppressOnMap;
    this.selectedDoc.verify.suppressOnMap = newVal || undefined;
    await this._doSave();
  }

  private async _doSave() {
    if (!this.selectedDoc || !this.selectedId || this.isSaving) return;
    this.isSaving = true;
    try {
      this.selectedDoc = await this._http.saveOrgDoc('verify', this.selectedId, this.selectedDoc);
      this.isDirty = false;
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
  get asVerify():   OrgVerify   | undefined  { return this.selectedDoc?.verify; }

  // ---- verifiedData helpers ----

  get verifiedData(): NonNullable<OrgVerify['verifiedData']> {
    const v = this.selectedDoc?.verify;
    if (!v) return {};
    if (!v.verifiedData) v.verifiedData = {};
    return v.verifiedData;
  }

  get verifiedDataEmpty(): boolean {
    const vd = this.selectedDoc?.verify?.verifiedData;
    if (!vd) return true;
    const c = vd.contacts;
    const hasContacts = !!(c && (c.website || c.phone || c.email || c.facebook || c.instagram || c.youtube));
    return !vd.description && (!vd.tags || !vd.tags.length) && !vd.category && !vd.name && !hasContacts;
  }

  get verifiedContacts(): NonNullable<NonNullable<OrgVerify['verifiedData']>['contacts']> {
    const vd = this.verifiedData;
    if (!vd.contacts) vd.contacts = {};
    return vd.contacts;
  }

  get isOnMap(): boolean {
    if (!this.selectedDoc) return false;
    if (this.selectedDoc.verify?.forcedPublish) return true;
    if (this.selectedDoc.verify?.suppressOnMap) return false;
    const score = this.selectedDoc.generate?.rank?.rank_score;
    return score != null && score >= this.scoringThreshold;
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
    if (!this.selectedDoc.verify) this.selectedDoc.verify = {} as OrgVerify;
    if (!this.selectedDoc.verify.verifiedData) this.selectedDoc.verify.verifiedData = {};
    const gc = this.selectedDoc.generate?.content;
    this.selectedDoc.verify.verifiedData.description = gc?.description ?? '';
    this.selectedDoc.verify.verifiedData.tags = gc?.tags ? [...gc.tags] : [];
    this.selectedDoc.verify.verifiedData.category = gc?.category ?? '';
    this.selectedDoc.verify.verifiedData.name = gc?.name ?? '';
    this.isDirty = true;
    this._cdr.detectChanges();
  }

  // ---- tag helpers ----

  removeVerifiedTag(tag: string) {
    const vd = this.verifiedData;
    vd.tags = (vd.tags ?? []).filter(t => t !== tag);
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
}
