/**
 * Multi-group chart sync engine. Timestamp/logical-range based, re-entrancy
 * guarded per broadcast (a member's `apply` that itself emits an event cannot
 * re-trigger the same group mid-broadcast). Members opt in to specific event
 * kinds via their `apply` implementation; the engine gates by group flags.
 *
 * Ported from the application's sync engine, genericized (domain-specific event
 * kinds removed).
 */

import type { ChartId } from "../core/types";
import type {
  ChartGroup,
  ChartGroupId,
  SyncEngine,
  SyncEvent,
  SyncFlag,
  SyncMember,
} from "./types";

interface GroupState {
  group: ChartGroup;
  members: Map<ChartId, SyncMember>;
}

export class SyncEngineImpl implements SyncEngine {
  private groups = new Map<ChartGroupId, GroupState>();
  private broadcasting = new Set<ChartGroupId>();
  private membershipSubs = new Set<(id: ChartGroupId, ids: readonly ChartId[]) => void>();
  private nextId = 1;

  createGroup(spec: Omit<ChartGroup, "id"> & { id?: ChartGroupId }): ChartGroupId {
    const id = spec.id ?? `g${this.nextId++}`;
    if (this.groups.has(id)) throw new Error(`SyncEngine: group "${id}" already exists`);
    this.groups.set(id, {
      group: { id, name: spec.name, color: spec.color, flags: new Set(spec.flags) },
      members: new Map(),
    });
    return id;
  }

  deleteGroup(id: ChartGroupId): void {
    this.groups.delete(id);
  }

  setFlags(id: ChartGroupId, flags: Set<SyncFlag>): void {
    const g = this.groups.get(id);
    if (!g) return;
    g.group = { ...g.group, flags: new Set(flags) };
  }

  listGroups(): readonly ChartGroup[] {
    return Array.from(this.groups.values()).map((g) => g.group);
  }

  getGroup(id: ChartGroupId): ChartGroup | undefined {
    return this.groups.get(id)?.group;
  }

  attach(groupId: ChartGroupId, member: SyncMember): () => void {
    const g = this.groups.get(groupId);
    if (!g) throw new Error(`SyncEngine: group "${groupId}" not found`);
    g.members.set(member.panelId, member);
    this.notifyMembership(groupId);
    return () => {
      g.members.delete(member.panelId);
      this.notifyMembership(groupId);
    };
  }

  broadcast(groupId: ChartGroupId, event: SyncEvent): void {
    if (this.broadcasting.has(groupId)) return;
    const g = this.groups.get(groupId);
    if (!g) return;
    if (!g.group.flags.has(this.flagFor(event))) return;

    this.broadcasting.add(groupId);
    try {
      const sourceId = "sourcePanelId" in event ? event.sourcePanelId : null;
      for (const [pid, m] of g.members) {
        if (pid === sourceId) continue;
        try {
          m.apply(event);
        } catch {
          /* member errors don't block siblings */
        }
      }
    } finally {
      this.broadcasting.delete(groupId);
    }
  }

  subscribeMembership(cb: (id: ChartGroupId, ids: readonly ChartId[]) => void): () => void {
    this.membershipSubs.add(cb);
    return () => this.membershipSubs.delete(cb);
  }

  private notifyMembership(id: ChartGroupId): void {
    const g = this.groups.get(id);
    const ids = g ? Array.from(g.members.keys()) : [];
    for (const cb of this.membershipSubs) {
      try {
        cb(id, ids);
      } catch {
        /* */
      }
    }
  }

  private flagFor(event: SyncEvent): SyncFlag {
    return event.kind;
  }
}

/** Convenience factory. */
export function createSyncEngine(): SyncEngine {
  return new SyncEngineImpl();
}
