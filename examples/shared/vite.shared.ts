import { resolve } from "node:path";

/**
 * Shared Vite alias map so examples consume the library straight from `src/`
 * (no build step needed to try them). In a real consumer app you would instead
 * `npm install @candlekit/charts` and drop these aliases.
 */
const root = resolve(__dirname, "../..");

export const candlekitAlias = {
  // Most-specific first — Vite matches aliases in declaration order.
  "@candlekit/charts/react/workspace": resolve(root, "src/react/workspace/index.ts"),
  "@candlekit/charts/styles.css": resolve(root, "styles.css"),
  "@candlekit/charts/react": resolve(root, "src/react/index.ts"),
  "@candlekit/charts": resolve(root, "src/index.ts"),
};

/**
 * Force these to a single copy. Because the alias points at the library `src/`
 * (above each example), imports like `lightweight-charts` / `react` made from
 * inside `src/` would otherwise resolve against the repo-root `node_modules`
 * (a second copy, or — in CI, where root deps aren't installed — none at all).
 * Deduping collapses them onto the example's own copy.
 */
export const candlekitDedupe = ["react", "react-dom", "lightweight-charts", "flexlayout-react"];

export const candlekitResolve = {
  alias: candlekitAlias,
  dedupe: candlekitDedupe,
};
