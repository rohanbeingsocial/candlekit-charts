# Contributing to @candlekit/charts

Thanks for helping improve the library. This guide covers setup, build, test,
and PR expectations. For architecture and extension points, read
[AGENTS.md](./AGENTS.md) and [CODEBASE_MAP.md](./CODEBASE_MAP.md) first.

## Setup

```bash
git clone https://github.com/rohanbeingsocial/candlekit-charts.git
cd candlekit-charts
npm install
```

`npm install` pulls the peer deps (`lightweight-charts`, `react`) plus the dev
toolchain. There are no other runtime dependencies — drawing and indicators are
built in.

> **Windows note:** if `npm run build` fails with
> `Cannot find module @rollup/rollup-win32-x64-msvc`, that is the known
> [npm optional-deps bug](https://github.com/npm/cli/issues/4828). Delete
> `node_modules` + `package-lock.json` and run `npm install` again (do **not**
> use `--no-optional`, which strips rollup's native binary).

## Build

```bash
npm run build        # tsup: ESM + CJS + .d.ts for both entries → dist/
npm run dev          # watch mode
```

Entries: `index` (core) and `react/index`. Both are tree-shakeable.

## Test

```bash
npm run test         # vitest run (unit)
npm run test:watch   # watch
npm run typecheck    # tsc --noEmit
npm run lint         # eslint
npm run format       # prettier --write
```

Tests live in `tests/`. Pure logic (data/resample, replay, sync, events) is unit
tested; DOM-dependent code is validated via `examples/`.

## Running the examples

```bash
cd examples/vanilla && npm install && npm run dev   # Vite dev server
```

(Each example is a standalone Vite app — see its README.)

## Pull request requirements

A PR is ready to merge when:

1. **Green pipeline** — `npm run typecheck && npm run lint && npm run test && npm run build` all pass.
2. **Tests** — new/changed behavior in `core`, `replay`, `sync`, or `events` has a test.
3. **Public API discipline** — new exports go through the barrels; breaking
   changes are called out and bump the major. See AGENTS.md "Public API rules".
4. **No core→react or core→engine imports** — dependency direction stays downward.
5. **No new runtime deps** — `lightweight-charts` is the only one; keep drawing
   and indicators self-contained.
6. **Docs updated** — if you change the public surface, update `README.md`,
   `docs/`, and `CHANGELOG.md`.
7. **Conventional commits** preferred (`feat:`, `fix:`, `docs:`, `refactor:`…).

## Code style

- TypeScript strict; epoch **milliseconds** in the public API.
- Pure functions in `core/`.
- Comments explain *why*. Prettier + ESLint are authoritative.

## Reporting issues / security

Open a GitHub issue with a minimal repro (a CodeSandbox/StackBlitz with the
example app is ideal). For suspected vulnerabilities, do not open a public issue —
use the repository's private security advisory channel.

## License

By contributing you agree your contributions are licensed under the project's
[MIT License](./LICENSE).
