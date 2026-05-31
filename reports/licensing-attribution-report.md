# Licensing & Attribution Report

Audit of every dependency in `@candlekit/charts`: license, attribution
requirement, redistribution rights, third-party origin, and how it is included.

## Summary

- **Our code:** MIT (`LICENSE`). This includes the **drawing engine and the
  indicator catalog**, which are original implementations — no third-party
  drawing or indicator source is incorporated.
- **One external runtime:** `lightweight-charts` (Apache-2.0), a peer dependency
  and the rendering engine. Its attribution is mandatory and provided.
- **No copyleft in anything redistributed.** No GPL/LGPL/AGPL/MPL in the runtime
  or published tree. (The dev-only toolchain pulls in `lightningcss`, MPL-2.0, as
  an *optional peer* transitive of Vite/Vitest; it is never installed at runtime,
  never in the `files` allowlist, and imposes no obligation on consumers.)
- **No third-party source is vendored** into this repository.
- Attributions consolidated in [`NOTICE`](../NOTICE).

## Dependency table

| Dependency | License | Attribution req. | Redistribution | Third-party origin | Included as | Action |
| --- | --- | --- | --- | --- | --- | --- |
| `lightweight-charts` | Apache-2.0 | NOTICE + retain license; ™ ack | ✅ | TradingView, Inc. | **peer** | Kept. Attributed; trademark acknowledged; non-affiliation stated. |
| `fancy-canvas` | MIT | Keep copyright/notice | ✅ | TradingView, Inc. | transitive (types) | Kept. Attributed. |
| `react`, `react-dom` | MIT | Keep notice | ✅ | Meta | **peer (optional)** | Only for `/react`. |

Dev-only tooling (`tsup`, `typescript`, `vitest`, `eslint`, `typescript-eslint`,
`prettier`, `@vitejs/plugin-react` *(examples)*, `@types/*`) is not redistributed
(not in the `files` allowlist) and is permissively licensed (MIT/Apache/ISC) —
the sole exception being `lightningcss` (MPL-2.0), an optional-peer transitive of
Vite/Vitest that is never installed at runtime nor shipped (see "No copyleft…").

## What changed vs. the first cut

The initial extraction depended on third-party drawing tools
(`lightweight-charts-line-tools-*`, MPL-2.0, git-hosted) and an indicator catalog
(`lightweight-charts-indicators` + `oakscriptjs`, MIT). To make the package fully
self-contained and unambiguously the project's own:

- **Drawing** was reimplemented from scratch (`src/drawing/*`) on
  lightweight-charts canvas primitives. The MPL packages were **removed** — no
  MPL code, no MPL obligations, no git-hosted dependency.
- **Indicators** were reimplemented as original math (`src/indicators/builtin.ts`:
  SMA, EMA, WMA, VWAP, Bollinger, RSI, MACD, ATR, Stochastic). The
  `lightweight-charts-indicators` / `oakscriptjs` dependencies were **removed**.

No attribution to those projects is required because none of their code remains.

## License-compatibility analysis

- **Apache-2.0 + MIT → MIT distribution:** compatible. MIT (our code) imposes no
  constraints upstream; Apache-2.0 and MIT permit redistribution with notice.
- **No copyleft in the runtime or published package** (no GPL/LGPL/AGPL/MPL), so
  nothing propagates obligations to `@candlekit/charts` or its consumers. The one
  MPL-2.0 package in the tree (`lightningcss`) is a dev-only optional-peer
  transitive of the build toolchain — not redistributed, not a runtime dep.
- **Trademark:** "Lightweight Charts™" is TradingView's mark. The code is
  Apache-2.0; the mark is acknowledged and non-affiliation is stated (README +
  NOTICE). No mark appears in the package name or branding.

## Attribution actions taken

1. `LICENSE` — MIT for all original code (incl. drawing + indicators).
2. `NOTICE` — `lightweight-charts` (Apache-2.0, with trademark + non-affiliation)
   and `fancy-canvas` (MIT); a line clarifying drawing/indicators are original.
3. README + docs credit lightweight-charts as the rendering engine.
4. No copied/derived third-party source files — no per-file header obligations.

## Redistribution rights — conclusion

`@candlekit/charts` may be published to npm and distributed publicly under MIT.
The only external runtime, `lightweight-charts`, installs from npm as a normal
peer dependency. There are no git-hosted or copyleft dependencies.
