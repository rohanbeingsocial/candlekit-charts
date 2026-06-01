import { defineConfig } from "tsup";

/**
 * Three tree-shakeable entries:
 *   index              framework-agnostic core (no React)
 *   react/index        React bindings (peer: react, react-dom)
 *   react/workspace    FlexLayout workspace system (peer: flexlayout-react)
 *
 * Drawing tools + indicators are part of the core — no separate entries, no
 * third-party drawing/indicator runtimes to externalize.
 */
export default defineConfig({
  entry: {
    index: "src/index.ts",
    "react/index": "src/react/index.ts",
    "react/workspace/index": "src/react/workspace/index.ts",
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
  external: ["react", "react-dom", "react/jsx-runtime", "lightweight-charts", "fancy-canvas", "flexlayout-react"],
});
