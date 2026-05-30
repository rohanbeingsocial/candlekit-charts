import { resolve } from "node:path";

/**
 * Shared Vite alias map so examples consume the library straight from `src/`
 * (no build step needed to try them). In a real consumer app you would instead
 * `npm install @candlekit/charts` and drop these aliases.
 */
const root = resolve(__dirname, "../..");

export const candlekitAlias = {
  // Most-specific first — Vite matches aliases in declaration order.
  "@candlekit/charts/styles.css": resolve(root, "styles.css"),
  "@candlekit/charts/react": resolve(root, "src/react/index.ts"),
  "@candlekit/charts/drawing-linetools": resolve(root, "src/drawing/lineToolsAdapter.ts"),
  "@candlekit/charts/indicators-oakscript": resolve(root, "src/indicators/oakscript.ts"),
  "@candlekit/charts": resolve(root, "src/index.ts"),
};
