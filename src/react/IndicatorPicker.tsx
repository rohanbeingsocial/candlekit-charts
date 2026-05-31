import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import type { IndicatorCategory, IndicatorDef, InputConfig } from "../indicators/types";
import { useChartApi } from "./context";

export interface IndicatorPickerProps {
  className?: string;
  style?: CSSProperties;
  /** Trigger button label. Default `"Indicators"`. */
  label?: string;
}

type Tab = "all" | IndicatorCategory;

const TABS: { id: Tab; label: string }[] = [
  { id: "all", label: "All" },
  { id: "overlay", label: "Overlays" },
  { id: "oscillator", label: "Oscillators" },
  { id: "pattern", label: "Patterns" },
];

const BADGE: Record<IndicatorCategory, string> = {
  overlay: "ck-ind-cat--overlay",
  oscillator: "ck-ind-cat--oscillator",
  pattern: "ck-ind-cat--pattern",
};

/**
 * Indicator picker as a dropdown: a trigger button opens a searchable, tabbed
 * popover of the registry with per-row toggle switches and inline params.
 * Wired to the enclosing {@link ChartView}'s indicator controller. Renders
 * nothing if indicators are not enabled.
 */
export function IndicatorPicker({ className, style, label = "Indicators" }: IndicatorPickerProps) {
  const { indicators } = useChartApi();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<Tab>("all");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  // Bumped after every mutation to re-read the controller's active state.
  const [, force] = useState(0);
  const rootRef = useRef<HTMLDivElement | null>(null);

  const grouped = useMemo(() => indicators?.available() ?? null, [indicators, open]);

  // Close on outside-click / Escape.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!indicators || !grouped) return null;

  const all = [...grouped.overlay, ...grouped.oscillator, ...grouped.pattern];
  const activeCount = indicators.activeNames().length;
  const total = all.length;

  const counts: Record<Tab, number> = {
    all: total,
    overlay: grouped.overlay.length,
    oscillator: grouped.oscillator.length,
    pattern: grouped.pattern.length,
  };

  const base = tab === "all" ? [...all].sort((a, b) => a.title.localeCompare(b.title)) : grouped[tab];
  const q = search.trim().toLowerCase();
  const list = q
    ? base.filter((d) => d.title.toLowerCase().includes(q) || d.shortTitle.toLowerCase().includes(q))
    : base;

  const sync = () => force((n) => n + 1);

  const toggle = (def: IndicatorDef) => {
    indicators.toggle(def.name);
    if (indicators.getActive(def.name) === undefined) {
      setExpanded((prev) => {
        const next = new Set(prev);
        next.delete(def.name);
        return next;
      });
    }
    sync();
  };

  const toggleExpand = (name: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });

  return (
    <div ref={rootRef} className={className ?? "ck-ind"} style={style}>
      <button
        type="button"
        className="ck-ind-trigger"
        aria-expanded={open}
        title="Indicators"
        onClick={() => setOpen((o) => !o)}
      >
        <span className="ck-ind-trigger-icon">ƒ</span>
        {label}
        {activeCount > 0 && <span className="ck-ind-count">{activeCount}</span>}
        <span className="ck-ind-caret">{open ? "▴" : "▾"}</span>
      </button>

      {open && (
        <div className="ck-ind-panel">
          <div className="ck-ind-head">
            <span className="ck-ind-title">Indicators</span>
            <button type="button" className="ck-ind-x" title="Close" onClick={() => setOpen(false)}>
              ✕
            </button>
          </div>

          <div className="ck-ind-search">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search…"
              autoFocus
            />
          </div>

          <div className="ck-ind-tabs">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                className={`ck-ind-tab${tab === t.id ? " ck-ind-tab--active" : ""}`}
                onClick={() => setTab(t.id)}
              >
                {t.label}
                <span className="ck-ind-tab-count">({counts[t.id]})</span>
              </button>
            ))}
          </div>

          <div className="ck-ind-list">
            {list.length === 0 && <div className="ck-ind-empty">No indicators found</div>}
            {list.map((def) => {
              const act = indicators.getActive(def.name);
              const active = act !== undefined;
              const hasParams = def.inputConfig.length > 0;
              const isOpen = expanded.has(def.name);
              return (
                <div key={def.name} className="ck-ind-item">
                  <div className={`ck-ind-row${active ? " ck-ind-row--active" : ""}`}>
                    <button
                      type="button"
                      className={`ck-ind-chev${active && hasParams ? "" : " ck-ind-chev--hidden"}`}
                      onClick={() => active && hasParams && toggleExpand(def.name)}
                    >
                      {isOpen ? "▾" : "▸"}
                    </button>
                    <div className="ck-ind-name">
                      <div className="ck-ind-name-title">{def.title}</div>
                      <div className="ck-ind-name-short">{def.shortTitle}</div>
                    </div>
                    <span className={`ck-ind-cat ${BADGE[def.category]}`}>
                      {def.category.slice(0, 3).toUpperCase()}
                    </span>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={active}
                      className={`ck-ind-switch${active ? " ck-ind-switch--on" : ""}`}
                      onClick={() => toggle(def)}
                    >
                      <span className="ck-ind-knob" />
                    </button>
                  </div>

                  {active && isOpen && hasParams && (
                    <div className="ck-ind-params">
                      {def.inputConfig.map((cfg) => (
                        <ParamRow
                          key={cfg.name}
                          cfg={cfg}
                          value={act.params[cfg.name]}
                          onChange={(val) => {
                            indicators.add(def.name, { ...act.params, [cfg.name]: val });
                            sync();
                          }}
                        />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="ck-ind-foot">
            <span>
              {activeCount} active · {total} total
            </span>
            {activeCount > 0 && (
              <button
                type="button"
                className="ck-ind-clear"
                onClick={() => {
                  indicators.clear();
                  setExpanded(new Set());
                  sync();
                }}
              >
                Clear all
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

interface ParamRowProps {
  cfg: InputConfig;
  value: unknown;
  onChange: (val: unknown) => void;
}

function ParamRow({ cfg, value, onChange }: ParamRowProps) {
  const labelText = cfg.title ?? cfg.name;
  const isNum = cfg.type === "int" || cfg.type === "float";
  return (
    <div className="ck-ind-param">
      <span className="ck-ind-param-label" title={labelText}>
        {labelText}
      </span>
      {isNum && (
        <input
          type="number"
          value={String(value ?? cfg.defval ?? "")}
          step={cfg.type === "int" ? 1 : 0.01}
          onChange={(e) => {
            const v = cfg.type === "int" ? parseInt(e.target.value, 10) : parseFloat(e.target.value);
            if (!Number.isNaN(v)) onChange(v);
          }}
        />
      )}
      {cfg.type === "bool" && (
        <input
          type="checkbox"
          checked={Boolean(value ?? cfg.defval)}
          onChange={(e) => onChange(e.target.checked)}
        />
      )}
      {cfg.type === "string" && Array.isArray(cfg.options) && (
        <select value={String(value ?? cfg.defval ?? "")} onChange={(e) => onChange(e.target.value)}>
          {cfg.options.map((o) => (
            <option key={String(o)} value={String(o)}>
              {String(o)}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}
