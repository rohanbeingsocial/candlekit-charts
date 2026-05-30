import { defineConfig } from "tsup";

/**
 * Multi-entry build. Each entry is an independent, tree-shakeable bundle so a
 * vanilla-JS consumer never pulls React, and a consumer who skips drawing /
 * indicators never pays for the optional integrations.
 *
 *   index                 framework-agnostic core (no React, no optional deps)
 *   react/index           React bindings (peer: react, react-dom)
 *   drawing-linetools     adapter for the MPL line-tools packages (optional dep)
 *   indicators-oakscript  registry built from lightweight-charts-indicators (optional dep)
 */
export default defineConfig({
  entry: {
    index: "src/index.ts",
    "react/index": "src/react/index.ts",
    "drawing-linetools": "src/drawing/lineToolsAdapter.ts",
    "indicators-oakscript": "src/indicators/oakscript.ts",
  },
  format: ["esm", "cjs"],
  dts: true,
  sourcemap: true,
  clean: true,
  treeshake: true,
  splitting: true,
  target: "es2020",
  outExtension({ format }) {
    return { js: format === "cjs" ? ".cjs" : ".js" };
  },
  // Never bundle peers or optional integrations — they resolve at the consumer.
  external: [
    "react",
    "react-dom",
    "react/jsx-runtime",
    "lightweight-charts",
    "fancy-canvas",
    "lightweight-charts-indicators",
    "oakscriptjs",
    /^lightweight-charts-line-tools-/,
  ],
});
