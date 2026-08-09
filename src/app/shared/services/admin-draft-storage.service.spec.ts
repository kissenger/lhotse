import { TestBed } from '@angular/core/testing';
import { AdminDraftStorageService } from './admin-draft-storage.service';

describe('AdminDraftStorageService', () => {
  let service: AdminDraftStorageService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(AdminDraftStorageService);
    localStorage.clear();
  });

  it('saves, restores, and clears drafts for a scope', () => {
    const draft = { title: 'Draft title', body: 'Body content' };

    service.saveDraft('article-editor', draft);

    expect(service.loadDraft<{ title: string; body: string }>('article-editor')).toEqual(draft);

    service.clearDraft('article-editor');

    expect(service.loadDraft<{ title: string; body: string }>('article-editor')).toBeNull();
  });
});
