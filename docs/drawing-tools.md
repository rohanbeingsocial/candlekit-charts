# Drawing Tools

Drawing is a `ChartPlugin` (`DrawingPlugin`) wrapping a runtime-agnostic
`DrawingEngine`. The engine talks to any object implementing the structural
`LineToolsRuntime` interface — the bundled adapter wires the MPL-2.0
`lightweight-charts-line-tools-*` packages, but you can supply your own.

## Tools

Built-in (via the bundled adapter): **TrendLine, Ray, ExtendedLine,
HorizontalLine, HorizontalRay, VerticalLine, Arrow, CrossLine, Rectangle, Circle,
FibRetracement**. Text and brush/freehand are available through the underlying
runtime and can be registered the same way.

## Install the optional runtime

The drawing packages are MPL-2.0 and **git-hosted (not on npm)**:

```bash
npm install \
  github:difurious/lightweight-charts-line-tools-core \
  github:difurious/lightweight-charts-line-tools-lines \
  github:difurious/lightweight-charts-line-tools-rectangle \
  github:difurious/lightweight-charts-line-tools-circle \
  github:difurious/lightweight-charts-line-tools-fib-retracement
```

They are declared as `optionalDependencies`, so install never hard-fails without
them — but `createLineToolsDrawingPlugin` throws at call time if they're absent.

## Enable drawing

```ts
import { createLineToolsDrawingPlugin } from "@candlekit/charts/drawing-linetools";

const drawing = await createLineToolsDrawingPlugin({
  storageKey: "drawings:AAPL", // persist to localStorage (omit to disable)
  magnetThreshold: 0,          // px; >0 snaps endpoints to OHLC
  tools: undefined,            // subset of DEFAULT_LINE_TOOLS, or all
});

chart.use(drawing);
drawing.engine?.startTool("TrendLine");
```

The factory is `async` because it lazy-loads the runtime — `await` it before
`chart.use`.

## React

```tsx
import { ChartView, DrawingToolbar } from "@candlekit/charts/react";

<ChartView data={bars} drawing={drawing}>
  <DrawingToolbar />
</ChartView>;
```

`DrawingToolbar` reads the plugin from `ChartView` context and renders buttons for
each tool plus delete/clear/lock. Style via `.ck-toolbar*` (import
`@candlekit/charts/styles.css`) or pass your own `className`.

## Engine API

```ts
const e = drawing.engine!;
e.startTool("Rectangle");      // begin placing a tool
e.stopTool();                  // cancel in-progress placement
e.removeSelected();            // delete the selected drawing(s)
e.removeAll();
e.setLocked(true);             // freeze all drawings (no edit/select)
e.export();                    // → JSON string
e.import(json);                // restore
const off = e.onAfterEdit(() => console.log("changed"));
```

## Persistence

Pass `storageKey` and edits autosave to `localStorage`. For a custom backend,
provide a `kv: KVStore` (`{ get, set }`) — e.g. write to your server. Drawings are
stored in the chart's coordinate domain; if you shift timestamps with
`applyFixedOffset`, persisted drawings stay positionally correct as long as you
keep the same offset.

## Bring your own runtime

Implement `LineToolsRuntime` (see `src/drawing/types.ts`) and build a plugin:

```ts
import { DrawingPlugin } from "@candlekit/charts";

const plugin = new DrawingPlugin({
  createRuntime: (chart, series) => myRuntime(chart, series),
  tools: [["MyTool", MyToolCtor]],
});
chart.use(plugin);
```

This is how new drawing backends are added without touching the core.

## Licensing

The bundled drawing runtime is **MPL-2.0** (file-level weak copyleft). Used
unmodified as a dependency, it imposes no source-disclosure obligation on your
app. See [NOTICE](../NOTICE) and
[reports/licensing-attribution-report.md](../reports/licensing-attribution-report.md).
