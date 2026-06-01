/**
 * @candlekit/charts/workspace — framework-agnostic workspace contracts + logic.
 *
 * Re-exported by the React workspace barrel. Consumers who only need the
 * contracts (e.g. to write a custom layout driver) can import from here.
 */

export * from "./types";
export { PanelRegistryImpl } from "./PanelRegistry";
export { WorkspaceRegistry } from "./WorkspaceRegistry";
export { WorkspaceManagerImpl, createWorkspace } from "./WorkspaceManager";
export { PassthroughLayoutEngine } from "./LayoutEngine";
export { LocalStoragePersistence, exportLayoutToJson, importLayoutFromJson } from "./LayoutPersistence";
export { buildDefaultLayout, buildSingleChartLayout } from "./DefaultLayouts";
