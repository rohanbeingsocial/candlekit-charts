/**
 * @getcandlekit/charts/react/workspace — React workspace bindings.
 *
 * FlexLayout-backed multi-panel workspace system. Optional peer dependency on
 * `flexlayout-react`.
 */

// Re-export core workspace contracts so consumers don't need two imports.
export * from "../../workspace";

// React context + provider
export { WorkspaceProvider, type WorkspaceProviderProps } from "./WorkspaceProvider";
export { WorkspaceContext } from "./WorkspaceContext";

// Hooks
export { useWorkspace } from "./hooks/useWorkspace";
export { usePanel, type UsePanelResult } from "./hooks/usePanel";
export { useLayout, type UseLayoutResult } from "./hooks/useLayout";

// FlexLayout adapter
export { FlexLayoutAdapter, type FlexLayoutAdapterProps } from "./flexlayout/FlexLayoutAdapter";
export { createModelFromJson, modelToJson } from "./flexlayout/ModelFactory";

// Built-in panels
export { ChartPanel, type ChartPanelConfig, DEFAULT_CHART_CONFIG } from "./panels/ChartPanel";
export {
  setWorkspaceIndicatorRegistry,
  getWorkspaceIndicatorRegistry,
} from "./panels/indicatorRegistry";
export { WatchlistPanel, type WatchlistConfig } from "./panels/WatchlistPanel";
export { IndicatorPanel, type IndicatorConfig } from "./panels/IndicatorPanel";
export { ToolPanel, type ToolConfig } from "./panels/ToolPanel";
export { DataPanel, type DataConfig } from "./panels/DataPanel";
