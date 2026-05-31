# Open-Source Readiness Audit

**Subject:** extraction of the charting library from a private trading dashboard
into the standalone public package `@candlekit/charts`.
**Date:** 2026-05-30.
**Verdict:** ✅ Ready to open-source. No secrets, credentials, internal URLs, or
backend code are present in the extracted surface. All dependencies are
redistributable. Domain-specific assumptions have been generalized.

---

## 1. Scope of extraction

**Included (generalized):** the framework-agnostic chart controller, drawing
engine + facade, measurement ruler, indicator registry/controller, deterministic
replay engine, multi-chart sync engine, event bus, plugin system, data utilities,
theme, and React bindings.

**Deliberately excluded:** everything domain-specific or proprietary — the
options-analytics charts (OI / PCR / max-pain / IV / straddle / VIX renderers),
the backend API, collectors, database, workspace/layout app shell, and all
business logic. See [excluded-files.md](./excluded-files.md).

The chosen scope is "generic technical-analysis charting library," matching the
requested feature set. The options analytics were treated as private business
logic and left in the original project.

## 2. Secret / leak scan

A targeted scan of every extracted source file for credentials and private
infrastructure was performed before and after porting.

| Risk class | Pattern searched | Finding |
| --- | --- | --- |
| Env vars / secrets | `process.env`, `import.meta.env`, `API_KEY`, `SECRET`, `PASSWORD`, `accessToken`, `clientId` | **None** in extracted code. |
| Internal URLs | `localhost`, `127.0.0.1`, `http(s)://`, `/api/` | **None.** |
| Backend / transport | `fetch(`, `axios`, `pg`, `express`, websocket, broker SDKs (`dhan`, `kite`) | **None** — the library has no transport; data enters via consumer-implemented sources. |
| Host-app coupling | `@/lib/*`, `@/components/*`, shadcn, app aliases | **Removed.** `cn`/Radix/`WireOhlcvRow`-style imports were replaced with internal helpers or local types. |
| Business identifiers | hard-coded symbols, exchange specifics, market hours | **Generalized.** IST offset + 09:15 session anchor became parameters (`applyFixedOffset`, `sessionOpenMinutes`, default UTC). |

No user data, no sample datasets from production, and no configuration specific
to the original project were carried over. Example data in the demos is synthetic.

## 3. Hidden-dependency analysis

The original chart code coupled to the host app via:

- `@/lib/utils` (`cn`) → replaced by a tiny internal class-merge where needed /
  removed (React components use plain `className`).
- `@/components/ui/*` (shadcn/Radix) → removed; overlay components are dependency-light.
- `@/lib/api` (`WireOhlcvRow`) → replaced by the library-owned `RawBar` type.
- App stores/contexts (zustand, workspace selectors) → not extracted; replaced by
  the standalone controllers + a small React context.

The third-party chart runtimes (drawing tools, indicator catalog) are **not**
bundled or vendored — they are declared as optional/peer dependencies and loaded
lazily, so a clone can build and test without them.

## 4. Reproducible build

- Pinned toolchain (`tsup`, `typescript`, `vitest`, `eslint`) in `devDependencies`.
- `prepublishOnly` runs typecheck + lint + test + build.
- CI matrix Node 18/20/22.
- Build verified locally: **typecheck clean, ESM+CJS+`.d.ts` for all 4 entries,
  23/23 unit tests pass, lint clean.**
- Known npm quirk documented (the `--no-optional` + rollup native-binary bug);
  CI uses a plain `npm install`.

## 5. Public-API hygiene

- Two barrels define the surface (`src/index.ts`, `src/react/index.ts`); nothing
  else is public.
- `sideEffects` limited to CSS → tree-shakeable.
- Two entries (`.` core, `./react`); the core bundle pulls in no framework code.
- Epoch-ms is the single time unit in the public API.

## 6. Residual risks / follow-ups

| Item | Severity | Note |
| --- | --- | --- |
| "Lightweight Charts™" trademark | Low | Apache-2.0 code; trademark acknowledged in NOTICE/README; project states non-affiliation. |
| DOM-heavy components (drawing/measurement render paths) | Low | Validated via examples; pure logic (data/resample/replay/sync/indicators math) is unit tested. |

## 7. Conclusion

The extracted package is free of proprietary material and safe to publish. License
obligations are satisfied via `LICENSE` (MIT for original code) and `NOTICE`
(third-party attributions). See
[licensing-attribution-report.md](./licensing-attribution-report.md) and
[migration-notes.md](./migration-notes.md).
