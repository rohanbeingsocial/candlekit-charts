/**
 * Drawing persistence helpers. Storage-agnostic via a tiny KV interface so
 * drawings can live in localStorage, a remote store, or anywhere else. A
 * localStorage adapter is provided for the common browser case.
 */

import type { DrawingEngine } from "./DrawingEngine";

export interface KVStore {
  get(key: string): string | null;
  set(key: string, value: string): void;
}

export const localStorageKV: KVStore = {
  get(key) {
    try {
      return typeof localStorage !== "undefined" ? localStorage.getItem(key) : null;
    } catch {
      return null;
    }
  },
  set(key, value) {
    try {
      if (typeof localStorage !== "undefined") localStorage.setItem(key, value);
    } catch {
      /* quota / unavailable */
    }
  },
};

export function saveDrawings(engine: DrawingEngine, key: string, kv: KVStore = localStorageKV): void {
  kv.set(key, engine.export());
}

export function loadDrawings(engine: DrawingEngine, key: string, kv: KVStore = localStorageKV): void {
  const raw = kv.get(key);
  if (raw) engine.import(raw);
}
