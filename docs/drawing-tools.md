# Drawing Tools

Drawing is a `ChartPlugin` (`DrawingController`) backed by an original,
MIT-licensed engine that renders on lightweight-charts canvas primitives. There
is **no third-party drawing runtime** and nothing extra to install — it ships in
the core.

## Tools

**TrendLine, Ray, ExtendedLine, HorizontalLine, VerticalLine, Rectangle, Circle,
Arrow, FibRetracement.** Add your own by extending the renderer + hit-test (see
"Custom tools" below) — that's the extensible drawing framework.

## Enable drawing

### React

```tsx
import { ChartView, DrawingToolbar } from "@candlekit/charts/react";

// `drawing` accepts: true | options object | a DrawingController instance.
<ChartView data={bars} drawing={{ storageKey: "drawings:AAPL" }}>
  <DrawingToolbar />
</ChartView>;
```

### Vanilla / imperative

```ts
import { ChartController, DrawingController } from "@candlekit/charts";

const chart = new ChartController(el);
const drawing = new DrawingController({ storageKey: "drawings:AAPL", hitTolerance: 6 });
chart.use(drawing);

drawing.engine.startTool("TrendLine");
```

## Interacting

- **Place:** with a tool active, click once (horizontal/vertical line) or twice
  (everything else — the second point previews as you move).
- **Select:** with no tool active, click a drawing. Drag its body to move, or a
  square handle to reshape.
- **Delete:** `Delete` / `Backspace` removes the selection.
- **Cancel / deselect:** `Escape`.
- Clicking empty space pans the chart as usual (drawing interaction only
  intercepts the mouse when it actually hits a drawing or a tool is active).

## Engine API (`drawing.engine`)

```ts
const e = drawing.engine;
e.startTool("Rectangle");          // begin placing
e.stopTool();                      // cancel the active tool
e.getActiveTool();                 // current tool or null
e.removeSelected();                // delete the selection
e.removeAll();
e.setLocked(true);                 // freeze all drawings (no select/edit)
e.setDefaultStyle({ color: "#ef5350", width: 2, dashed: true });
e.export();                        // → JSON string
e.import(json);                    // restore
const off = e.onChange(() => {});  // fires after any create/move/style/delete
```

## Persistence

Pass `storageKey` and edits autosave to `localStorage`. For another backend,
pass `kv: KVStore` (`{ get, set }`). Anchors are stored in **data space**
(lightweight-charts time + price), so saved drawings stay positionally correct
across reloads, pan, and zoom. If you shift timestamps with `applyFixedOffset`,
keep the same offset and persisted drawings remain correct.

## Custom tools

The engine model is a serializable `Drawing { id, tool, points, style }`. To add
a tool:

1. Add its id to your `DrawingToolId` usage and to `TOOL_POINTS` (how many anchor
   points it needs).
2. Add a `case` to the renderer (`DrawingPrimitive`) for how it paints.
3. Add a `case` to the hit-test (`DrawingController.bodyHit`) for selection.

Because the model is plain data, custom tools serialize + persist for free.

## Architecture

```
DrawingController (ChartPlugin)         pointer/keyboard → mutations
   ├─ DrawingEngine                     pure model + events + export/import
   └─ DrawingPrimitive (ISeriesPrimitive) renders model on the chart canvas
```

The engine never touches the DOM; the primitive never mutates state; the
controller wires them to the chart. Swap any layer independently.
