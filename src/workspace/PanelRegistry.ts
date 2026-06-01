/**
 * Plugin-style panel registry.
 *
 * Consumers register panel definitions (kind + component + defaultConfig).
 * The workspace shell looks them up by kind when rendering tabs.
 */

import type { PanelDefinition, PanelRegistry } from "./types";

export class PanelRegistryImpl implements PanelRegistry {
  private map = new Map<string, PanelDefinition>();

  register(def: PanelDefinition): void {
    if (this.map.has(def.kind)) {
      throw new Error(`PanelRegistry: kind "${def.kind}" already registered`);
    }
    this.map.set(def.kind, def);
  }

  get(kind: string): PanelDefinition | undefined {
    return this.map.get(kind);
  }

  list(): readonly PanelDefinition[] {
    return Array.from(this.map.values());
  }
}
