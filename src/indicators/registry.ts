/**
 * Indicator registry. Holds {@link IndicatorDef}s by name and groups them by
 * category. Empty by default — register the built-in set
 * (`createBuiltinRegistry` from `builtin.ts`) and/or your own custom
 * indicators. This is the extensible indicator framework.
 */

import type { IndicatorCategory, IndicatorDef } from "./types";

export class IndicatorRegistry {
  private defs = new Map<string, IndicatorDef>();

  /** Register one definition (overwrites a same-named entry). */
  register(def: IndicatorDef): this {
    this.defs.set(def.name, def);
    return this;
  }

  /** Register many at once. */
  registerAll(defs: Iterable<IndicatorDef>): this {
    for (const d of defs) this.register(d);
    return this;
  }

  get(name: string): IndicatorDef | undefined {
    return this.defs.get(name);
  }

  has(name: string): boolean {
    return this.defs.has(name);
  }

  list(): IndicatorDef[] {
    return [...this.defs.values()];
  }

  /** Definitions grouped + alpha-sorted by category. */
  byCategory(): Record<IndicatorCategory, IndicatorDef[]> {
    const out: Record<IndicatorCategory, IndicatorDef[]> = {
      overlay: [],
      oscillator: [],
      pattern: [],
    };
    for (const d of this.defs.values()) out[d.category].push(d);
    for (const list of Object.values(out)) list.sort((a, b) => a.title.localeCompare(b.title));
    return out;
  }
}

/**
 * Build an {@link IndicatorDef} from a raw definition shaped as a `calculate`
 * fn + `metadata` + configs. Exported for adapting any externally-shaped
 * indicator source into the registry without coupling the core to it.
 */
export function defFromRaw(name: string, raw: unknown): IndicatorDef | null {
  if (!isIndicatorLike(raw)) return null;
  const meta = raw.metadata;
  const plotConfig = Array.isArray(raw.plotConfig) ? raw.plotConfig : [];
  const category: IndicatorCategory =
    plotConfig.length === 0 ? "pattern" : meta.overlay ? "overlay" : "oscillator";
  return {
    name,
    title: meta.title ?? name,
    shortTitle: meta.shortTitle ?? name,
    category,
    calculate: (bars, inputs) => raw.calculate(bars, inputs),
    defaultInputs: raw.defaultInputs ?? {},
    inputConfig: (Array.isArray(raw.inputConfig) ? raw.inputConfig : []) as IndicatorDef["inputConfig"],
    plotConfig: plotConfig as IndicatorDef["plotConfig"],
    hlineConfig: (Array.isArray(raw.hlineConfig) ? raw.hlineConfig : []) as IndicatorDef["hlineConfig"],
  };
}

interface IndicatorLike {
  calculate: IndicatorDef["calculate"];
  metadata: { title?: string; shortTitle?: string; overlay: boolean };
  defaultInputs?: Record<string, unknown>;
  inputConfig?: unknown[];
  plotConfig?: unknown[];
  hlineConfig?: unknown[];
}

function isIndicatorLike(v: unknown): v is IndicatorLike {
  return (
    typeof v === "object" &&
    v !== null &&
    typeof (v as Record<string, unknown>).calculate === "function" &&
    typeof (v as Record<string, unknown>).metadata === "object"
  );
}
