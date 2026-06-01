/**
 * Default layout templates.
 *
 * Returns FlexLayout-compatible JSON models. These are opaque blobs from the
 * core's perspective; the React adapter passes them straight to
 * `Model.fromJson`.
 */

import type { LayoutTreeBlob } from "./types";

export function buildDefaultLayout(): LayoutTreeBlob {
  return {
    global: {
      tabEnableClose: true,
      tabEnableRename: false,
      tabSetEnableMaximize: true,
      splitterSize: 6,
      splitterExtra: 2,
      tabSetMinWidth: 120,
      tabSetMinHeight: 80,
    },
    borders: [
      { type: "border", location: "bottom", enableAutoHide: true, children: [] },
    ],
    layout: {
      type: "row",
      weight: 100,
      children: [
        {
          type: "tabset",
          weight: 50,
          children: [
            {
              type: "tab",
              id: "panel-chart-1",
              name: "Chart 1",
              component: "chart",
              config: {
                id: "panel-chart-1",
                kind: "chart",
                title: "Chart 1",
                config: { symbol: "DEMO", interval: "1m" },
                groupId: "G1",
              },
            },
          ],
        },
        {
          type: "tabset",
          weight: 50,
          children: [
            {
              type: "tab",
              id: "panel-chart-2",
              name: "Chart 2",
              component: "chart",
              config: {
                id: "panel-chart-2",
                kind: "chart",
                title: "Chart 2",
                config: { symbol: "DEMO", interval: "1m" },
                groupId: "G1",
              },
            },
          ],
        },
      ],
    },
  };
}

/** A single-chart layout for consumers who want a minimal start. */
export function buildSingleChartLayout(): LayoutTreeBlob {
  return {
    global: {
      tabEnableClose: true,
      tabEnableRename: false,
      tabSetEnableMaximize: true,
      splitterSize: 6,
      splitterExtra: 2,
      tabSetMinWidth: 120,
      tabSetMinHeight: 80,
    },
    borders: [
      { type: "border", location: "bottom", enableAutoHide: true, children: [] },
    ],
    layout: {
      type: "row",
      weight: 100,
      children: [
        {
          type: "tabset",
          weight: 100,
          children: [
            {
              type: "tab",
              id: "panel-chart-1",
              name: "Chart",
              component: "chart",
              config: {
                id: "panel-chart-1",
                kind: "chart",
                title: "Chart",
                config: { symbol: "DEMO", interval: "1m" },
              },
            },
          ],
        },
      ],
    },
  };
}
