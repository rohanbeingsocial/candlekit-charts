/**
 * @getcandlekit/charts/react — React bindings.
 *
 * Re-exports the core surface plus the React components/hooks so consumers can
 * import everything from one place when using React.
 */

export * from "../index";

export { ChartView, type ChartViewProps } from "./ChartView";
export { DrawingToolbar, type DrawingToolbarProps } from "./DrawingToolbar";
export { IndicatorPicker, type IndicatorPickerProps } from "./IndicatorPicker";
export { MeasurementOverlay, type MeasurementOverlayProps } from "./MeasurementOverlay";
export { SketchSearchButton, type SketchSearchButtonProps } from "./SketchSearchButton";
export { EchoesPanel, type EchoesPanelProps } from "./EchoesPanel";
export { ReplayControls, type ReplayControlsProps } from "./ReplayControls";
export { SplitPane, type SplitPaneProps } from "./SplitPane";
export { useChartController } from "./hooks/useChartController";
export { usePageTheme, type PageTheme } from "./hooks/usePageTheme";
export { ChartContext, useChartApi, useChartApiOptional, type ChartViewApi } from "./context";
