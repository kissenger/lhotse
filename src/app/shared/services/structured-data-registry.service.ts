import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class StructuredDataRegistryService {
  private _entries = new Map<string, object[]>();

  register(source: string, schemas: object | object[]) {
    const normalized = Array.isArray(schemas) ? schemas : [schemas];
    this._entries.set(source, normalized);
  }

  getAll(): object[] {
    return Array.from(this._entries.values()).flat();
  }

  clear() {
    this._entries.clear();
  }
}