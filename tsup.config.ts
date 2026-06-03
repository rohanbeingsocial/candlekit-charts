import { defineConfig } from "tsup";

/**
 * Tree-shakeable entries:
 *   index              framework-agnostic core (no React)
 *   react/index        React bindings (peer: react, react-dom)
 *   react/workspace    FlexLayout workspace system (peer: flexlayout-react)
 *   indicators-tv      optional bulk catalog (peer: lightweight-charts-indicators, oakscriptjs)
 *
 * The original drawing tools + built-in indicators live in the core entry. The
 * indicators-tv entry is opt-in so the core ships no third-party indicator
 * runtime unless a consumer imports it.
 */
export default defineConfig({
  entry: {
    index: "src/index.ts",
    "react/index": "src/react/index.ts",
    "react/workspace/index": "src/react/workspace/index.ts",
    "indicators-tv/index": "src/indicators-tv/index.ts",
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
  // Never bundle peers — they resolve at the consumer.
  external: [
    "react",
    "react-dom",
    "react/jsx-runtime",
    "lightweight-charts",
    "fancy-canvas",
    "flexlayout-react",
    "lightweight-charts-indicators",
    "oakscriptjs",
  ],
});
