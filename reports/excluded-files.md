# Excluded Files & Code

What was intentionally **left out** of `@getcandlekit/charts` during extraction, and
why. The goal: a clean-room generic charting library with zero proprietary or
private material and no dependency on the original application.

## Principle

Only generic technical-analysis charting code was extracted. Anything that
encodes business logic, market-domain specifics, infrastructure, or host-app UI
was excluded. Where a generic capability was entangled with domain code, the
generic part was re-authored and the domain part dropped.

## Excluded from the original workspace

### Domain / business logic (the options analytics)
- The entire options-analytics chart module (OI, OI-change, PCR, max-pain, IV,
  IV-percentile, straddle/strangle, spot-vs-futures, VIX renderers) and its
  analytics toolbar, symbol search, and panel/stack/replay-timeline shells.
- *Reason:* options/market-microstructure business logic; not part of a generic
  charting library; treated as private.

### Backend & data plane (never extracted)
- Node/Express API, route handlers, auth middleware, query cache.
- Python collectors, Dhan/broker WebSocket + REST clients, market-hours/pacing.
- TimescaleDB schema, migrations, continuous aggregates.
- Backfill / backtest / pricing sidecar services.
- *Reason:* servers, secrets, transport, credentials, database. The library has no
  transport; data is supplied by consumer-implemented `*DataSource` interfaces.

### Host-app shell & state
- Workspace/FlexLayout multi-panel app, global symbol/expiry/date selectors,
  zustand stores, persistence keys, routing, pages.
- shadcn/Radix UI kit, Tailwind app config, `@/lib/*` utilities.
- *Reason:* application-specific UI/state, not a chart concern.

### Configuration & ops
- `.env*`, Docker/compose files, Raspberry-Pi deploy scripts, CI/CD secrets,
  backup tooling.
- *Reason:* environment-specific; potential secret exposure.

## Re-authored instead of copied (decoupled)

| Original (host-coupled) | In the library |
| --- | --- |
| `ChartCanvas.tsx` (shadcn/lucide, app aliases, IST hardcode) | `ChartController` (core) + `ChartView` (React), dependency-light |
| `chartData.ts` (`@/lib/api` `WireOhlcvRow`, IST offset, NSE 09:15 anchor) | `core/data.ts` + `core/time.ts` — `RawBar`, parameterized `sessionOpenMinutes`, `applyFixedOffset` |
| `engine/DrawingEngine.ts` (wrapper over a third-party line-tools runtime) | `drawing/*` — original engine (`DrawingEngine` + `DrawingPrimitive` + `DrawingController`) on lightweight-charts primitives; no third-party drawing runtime |
| `indicators/registry.ts` + `IndicatorManager.tsx` (third-party indicator runtime) | `indicators/*` — `IndicatorRegistry` + `IndicatorController` + original `builtin.ts` catalog; no third-party indicator runtime |
| `measurement/MeasurementManager.tsx` (React glue) | `MeasurementController` (framework-agnostic) |
| `packages/replay-engine`, `sync-engine`, `chart-engine`, `workspace` | `replay/`, `sync/`, `core/`, `plugins/`, `data-source/` — `@ourorg`→`@getcandlekit`, domain event kinds (`expiry`) removed |

## Carried over (clean, generic)
- The replay cursor/LRU algorithm, the sync broadcast/re-entrancy logic, the
  ruler canvas primitive, and the indicator reconciliation lifecycle — all were
  already domain-free and ported with import-path + naming changes only.

## Verification
Post-extraction scans for secrets, internal URLs, backend imports, and host-app
aliases returned **zero matches** in the published `src/`. See
[open-source-readiness-audit.md](./open-source-readiness-audit.md) §2–3.
