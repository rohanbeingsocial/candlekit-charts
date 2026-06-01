/**
 * Multi-workspace registry.
 *
 * Holds named workspace managers so an app can switch between layouts
 * without losing state.
 */

import type { WorkspaceManager } from "./types";

export class WorkspaceRegistry {
  private map = new Map<string, WorkspaceManager>();

  register(manager: WorkspaceManager): void {
    this.map.set(manager.id, manager);
  }

  get(id: string): WorkspaceManager | undefined {
    return this.map.get(id);
  }

  list(): readonly WorkspaceManager[] {
    return Array.from(this.map.values());
  }

  delete(id: string): boolean {
    return this.map.delete(id);
  }
}
