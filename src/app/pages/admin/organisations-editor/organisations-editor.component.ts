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

  askForConfirmation = false;
  askForOverwriteVerify = false;
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
    this.loadList();
  }

  // ---- list loading ----

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
    this.isSaving = true;
    if (!this.selectedDoc.verify) this.selectedDoc.verify = {} as OrgVerify;
    this.selectedDoc.verify.verified = true;
    this.selectedDoc.verify.verifiedAt = new Date().toISOString();
    this.selectedDoc.verify.newContentPendingVerification = false;
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

  // ---- verify ----

  async onVerify() {
    await this.onSave();
  }

  // ---- publish / unpublish ----

  async onPublish() {
    if (!this.selectedDoc || !this.selectedId || this.isDirty) return;
    if (!this.selectedDoc.verify) this.selectedDoc.verify = {} as OrgVerify;
    this.selectedDoc.verify.publish = true;
    this.selectedDoc.verify.publishedAt = new Date().toISOString();
    await this.onSave();
  }

  async onUnpublish() {
    if (!this.selectedDoc || !this.selectedId) return;
    if (!this.selectedDoc.verify) this.selectedDoc.verify = {} as OrgVerify;
    this.selectedDoc.verify.publish = false;
    await this.onSave();
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
    return !vd.description && (!vd.tags || !vd.tags.length) && !vd.category && !vd.name;
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
    const g = this.selectedDoc.generate;
    this.selectedDoc.verify.verifiedData.description = g?.description ?? '';
    this.selectedDoc.verify.verifiedData.tags = g?.tags ? [...g.tags] : [];
    this.selectedDoc.verify.verifiedData.category = g?.category ?? '';
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
    const sources = this.selectedDoc?.generate?.grounding_sources ?? [];
    const website = this.selectedDoc?.discover?.website;
    const seen = new Set<string>(website ? [website] : []);
    return sources.filter(s => { if (seen.has(s)) return false; seen.add(s); return true; });
  }

  get sortedListItems(): OrgListItem[] {
    return [...this.listItems].sort((a, b) => (b.rank_score ?? -Infinity) - (a.rank_score ?? -Infinity));
  }

  get flaggedForUpdate(): boolean {
    return !!this.selectedDoc?.generate?.flaggedForUpdate;
  }

  set flaggedForUpdate(val: boolean) {
    if (!this.selectedDoc) return;
    if (!this.selectedDoc.generate) this.selectedDoc.generate = {} as OrgGenerate;
    this.selectedDoc.generate.flaggedForUpdate = val ? true : false;
    this.isDirty = true;
  }

  get newContentAvailable(): boolean {
    return !!this.selectedDoc?.generate?.newContentAvailable;
  }

  set newContentAvailable(val: boolean) {
    if (!this.selectedDoc) return;
    if (!this.selectedDoc.generate) this.selectedDoc.generate = {} as OrgGenerate;
    this.selectedDoc.generate.newContentAvailable = val ? true : false;
    this.isDirty = true;
  }

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
    const scores = this.selectedDoc?.generate?.criterion_scores;
    const rationale = this.selectedDoc?.generate?.criterion_rationale;
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
