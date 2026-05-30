# Licensing & Attribution Report

Audit of every dependency in `@candlekit/charts`: license, attribution
requirement, redistribution rights, third-party origin, and how it is included.

## Summary

- **Our code:** MIT (`LICENSE`).
- **All dependencies are redistributable.** No GPL/AGPL. One weak-copyleft
  (MPL-2.0) drawing runtime, used unmodified as an optional dependency — no
  source-disclosure obligation extends to consumers.
- **No third-party source is vendored** into this repository. Everything resolves
  at the consumer via peer/optional dependencies.
- Attributions consolidated in [`NOTICE`](../NOTICE).

## Dependency table

| Dependency | License | Attribution req. | Redistribution | Third-party origin | Included as | Action |
| --- | --- | --- | --- | --- | --- | --- |
| `lightweight-charts` | Apache-2.0 | NOTICE + retain license; ™ ack | ✅ | TradingView, Inc. | **peer** | Kept. Attributed; trademark acknowledged; non-affiliation stated. |
| `fancy-canvas` | MIT | Keep copyright/notice | ✅ | TradingView, Inc. | transitive (types) | Kept. Attributed. |
| `lightweight-charts-indicators` | MIT | Keep copyright/notice | ✅ | deepentropy | **optional** | Kept. Lazy-loaded via `/indicators-oakscript`. |
| `oakscriptjs` | MIT | Keep copyright/notice | ✅ | deepentropy | **optional** (transitive of indicators) | Kept. |
| `lightweight-charts-line-tools-core` | MPL-2.0 | Keep notices; modified files stay MPL | ✅ | difurious | **optional** (git) | Kept, unmodified. Wiring isolated in adapter. |
| `lightweight-charts-line-tools-lines` | MPL-2.0 | as above | ✅ | difurious | **optional** (git) | Kept, unmodified. |
| `lightweight-charts-line-tools-rectangle` | MPL-2.0 | as above | ✅ | difurious | **optional** (git) | Kept, unmodified. |
| `lightweight-charts-line-tools-circle` | MPL-2.0 | as above | ✅ | difurious | **optional** (git) | Kept, unmodified. |
| `lightweight-charts-line-tools-fib-retracement` | MPL-2.0 | as above | ✅ | difurious | **optional** (git) | Kept, unmodified. |
| `react`, `react-dom` | MIT | Keep notice | ✅ | Meta | **peer (optional)** | Only for `/react`. |

Dev-only tooling (`tsup`, `typescript`, `vitest`, `eslint`, `typescript-eslint`,
`prettier`, `@types/*`) is not redistributed (not in the `files` allowlist) and is
permissively licensed (MIT/Apache/ISC).

## License-compatibility analysis

- **Apache-2.0 + MIT + MPL-2.0 → MIT distribution:** compatible. MIT (our code)
  imposes no constraints upstream; Apache-2.0 and MIT permit redistribution with
  notice; MPL-2.0 is **file-level** copyleft — it only obliges disclosure of
  *modifications to MPL files*. We do not modify them (used as dependencies), so
  there is no copyleft reach into `@candlekit/charts` or its consumers.
- **No viral/network copyleft** (no GPL/LGPL/AGPL) anywhere in the tree.
- **Trademark:** "Lightweight Charts™" is TradingView's mark. The code is
  Apache-2.0; the mark is acknowledged and non-affiliation is stated (README +
  NOTICE). No mark is used in the package name or branding.

## Attribution actions taken

1. `LICENSE` — MIT for original code.
2. `NOTICE` — per-dependency copyright, license, and URLs; explicit Apache-2.0
   acknowledgment for lightweight-charts and MPL-2.0 explanation for the drawing
   runtime.
3. README + drawing-tools doc state the MPL-2.0 terms and the git-install path.
4. No copied/derived source files — so no per-file MPL header obligations arise in
   this repo. (If drawing-tool source is ever vendored/forked, those files must
   retain their MPL headers.)

## Redistribution rights — conclusion

`@candlekit/charts` may be published to npm and distributed publicly under MIT.
Optional dependencies are resolved at the consumer; the git-hosted MPL packages
are the only non-npm install step and are clearly documented.
