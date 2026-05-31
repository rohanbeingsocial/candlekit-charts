# Contributing (docs)

The canonical contributing guide lives at the repo root:
[CONTRIBUTING.md](../CONTRIBUTING.md). This page is the docs-site mirror and adds
a few pointers.

## TL;DR

```bash
npm install
npm run typecheck && npm run lint && npm run test && npm run build
```

All four must be green before a PR merges.

## Where things live

- Architecture + extension points → [AGENTS.md](../AGENTS.md)
- Directory/dependency/data-flow map → [CODEBASE_MAP.md](../CODEBASE_MAP.md)
- API surface → [api-reference.md](./api-reference.md)

## Adding to the public API

1. Implement under the right `src/` folder (respect the downward import rule).
2. Re-export from the appropriate barrel (`src/index.ts` or `src/react/index.ts`).
3. Add a tsup `entry` + `package.json` `exports` key **only** for a new subpath.
4. Document it (`docs/`, `README.md`) and add a `CHANGELOG.md` line.
5. Add a test if it's logic in `core`/`replay`/`sync`/`events`.

## Runtime dependencies

`lightweight-charts` is the only external runtime (a peer). Drawing tools and
indicators are original, self-contained implementations — do not add new runtime
dependencies for them. See
[architecture.md](./architecture.md#self-contained-drawing--indicators).

## Reporting

Issues: GitHub with a minimal repro. Security: private advisory, not a public
issue.
