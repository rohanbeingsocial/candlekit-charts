/**
 * LayoutPersistence adapters.
 *
 * Provides localStorage-backed and JSON file import/export persistence.
 * Designed so a future backend or cloud-sync adapter can be swapped in
 * without touching panels or the workspace shell.
 */

import type { LayoutPersistence, WorkspaceLayout, WorkspaceLayoutSummary } from "./types";

// ── LocalStorage adapter ─────────────────────────────────────────────────────

export interface LocalStorageAdapter {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
  length: number;
  key(index: number): string | null;
}

export class LocalStoragePersistence implements LayoutPersistence {
  private prefix: string;
  private store: LocalStorageAdapter;

  constructor(store: LocalStorageAdapter = typeof localStorage !== "undefined" ? localStorage : new MemoryStorage(), prefix = "candlekit.workspace") {
    this.store = store;
    this.prefix = prefix;
  }

  async get(id: string): Promise<WorkspaceLayout | null> {
    const raw = this.store.getItem(`${this.prefix}.layout.${id}`);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as WorkspaceLayout;
    } catch {
      return null;
    }
  }

  async save(layout: WorkspaceLayout): Promise<void> {
    this.store.setItem(`${this.prefix}.layout.${layout.id}`, JSON.stringify(layout));
    // Update the index.
    const index = await this.readIndex();
    const existing = index.find((i) => i.id === layout.id);
    if (existing) {
      existing.name = layout.name;
      existing.updatedAt = layout.updatedAt;
    } else {
      index.push({ id: layout.id, name: layout.name, updatedAt: layout.updatedAt });
    }
    this.writeIndex(index);
  }

  async list(): Promise<readonly WorkspaceLayoutSummary[]> {
    return this.readIndex();
  }

  async delete(id: string): Promise<void> {
    this.store.removeItem(`${this.prefix}.layout.${id}`);
    const index = this.readIndex().filter((i) => i.id !== id);
    this.writeIndex(index);
  }

  private readIndex(): WorkspaceLayoutSummary[] {
    const raw = this.store.getItem(`${this.prefix}.index`);
    if (!raw) return [];
    try {
      return JSON.parse(raw) as WorkspaceLayoutSummary[];
    } catch {
      return [];
    }
  }

  private writeIndex(index: WorkspaceLayoutSummary[]): void {
    this.store.setItem(`${this.prefix}.index`, JSON.stringify(index));
  }
}

/** In-memory fallback when localStorage is unavailable (SSR, tests, etc.). */
class MemoryStorage implements LocalStorageAdapter {
  private data = new Map<string, string>();

  get length(): number {
    return this.data.size;
  }

  getItem(key: string): string | null {
    return this.data.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.data.set(key, value);
  }

  removeItem(key: string): void {
    this.data.delete(key);
  }

  key(index: number): string | null {
    return Array.from(this.data.keys())[index] ?? null;
  }
}

// ── JSON file adapter ────────────────────────────────────────────────────────

export function exportLayoutToJson(layout: WorkspaceLayout): string {
  return JSON.stringify(layout, null, 2);
}

export function importLayoutFromJson(json: string): WorkspaceLayout | null {
  try {
    const parsed = JSON.parse(json) as WorkspaceLayout;
    if (!parsed || typeof parsed !== "object" || !parsed.tree) return null;
    return parsed;
  } catch {
    return null;
  }
}
