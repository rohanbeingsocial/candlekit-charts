import type { DrawingToolId } from "./types";

/** SVG path data used by CandleKit's drawing-toolbar adapters. */
export interface DrawingToolIconDefinition {
  path: string;
}

export interface DrawingToolDefinition {
  id: DrawingToolId;
  label: string;
}

export interface DrawingToolGroupDefinition {
  id: string;
  label: string;
  /** Tool id whose glyph represents the group on a compact toolbar. */
  icon: DrawingToolId;
  sections: Array<{
    label?: string;
    tools: DrawingToolDefinition[];
  }>;
}

/**
 * CandleKit's drawing glyphs follow Project B's 24x24 line-art contract.
 * Keeping path data here makes the core the owner of tool identity and icon
 * choice; React, Vue, and future adapters only need to render the path.
 */
export const DRAWING_TOOL_ICONS: Readonly<Record<string, DrawingToolIconDefinition>> = {
  TrendLine: { path: "M6 18 18 6M5 18a1 1 0 0 0 2 0a1 1 0 0 0 -2 0zM17 6a1 1 0 0 0 2 0a1 1 0 0 0 -2 0z" },
  Ray: { path: "M4 18 22 6M3 18a1 1 0 0 0 2 0a1 1 0 0 0 -2 0z" },
  ExtendedLine: { path: "M2 22 22 2M7 16a1 1 0 0 0 2 0a1 1 0 0 0 -2 0zM15 8a1 1 0 0 0 2 0a1 1 0 0 0 -2 0z" },
  Arrow: { path: "M4 20 15 9M20 4l-2 8-6-6z" },
  InfoLine: { path: "M6 18 18 6M3 3h8v5H3zM5 18a1 1 0 0 0 2 0a1 1 0 0 0 -2 0zM17 6a1 1 0 0 0 2 0a1 1 0 0 0 -2 0z" },
  TrendAngle: { path: "M4 20 18 8M4 20h12M8 20a8 8 0 0 0 2-5" },
  HorizontalLine: { path: "M2 12h20" },
  HorizontalRay: { path: "M10 12h12M9 12a1 1 0 0 0 2 0a1 1 0 0 0 -2 0z" },
  VerticalLine: { path: "M12 2v20" },
  CrossLine: { path: "M2 12h20M12 2v20M11 12a1 1 0 0 0 2 0a1 1 0 0 0 -2 0z" },
  ParallelChannel: { path: "M2 16 14 4M8 22 20 10" },
  FibChannel: { path: "M2 14 14 4M4 18 16 8M6 22 18 12" },
  DisjointChannel: { path: "M2 16 14 6M8 22 22 14" },
  FlatTopBottom: { path: "M3 5h18M3 19h18M6 5v14M18 5v14" },
  RegressionChannel: { path: "M3 18 19 6M5 21 21 9M3 12 17 2M10 16h4" },
  Pitchfork: { path: "M5 2v8h14V2M12 2v19M11 21a1 1 0 0 0 2 0a1 1 0 0 0 -2 0z" },
  SchiffPitchfork: { path: "M5 2v8h14V2M12 2v12h7M18 14a1 1 0 0 0 2 0a1 1 0 0 0 -2 0z" },
  ModifiedSchiffPitchfork: { path: "M5 2v8h14V2M12 2v13M5 10l14 10M18 20a1 1 0 0 0 2 0a1 1 0 0 0 -2 0z" },
  InsidePitchfork: { path: "M5 2v8h14V2M12 2v8M5 10l7 10 7-10M11 20a1 1 0 0 0 2 0a1 1 0 0 0 -2 0z" },
  FibRetracement: { path: "M3 4h18M3 9h18M3 14h18M3 19h18" },
  FibExtension: { path: "M3 5h18M3 12h18M3 19h18M8 5v14" },
  FibTimeZone: { path: "M4 3v18M8 3v18M14 3v18M22 3v18" },
  FibFan: { path: "M3 20 21 4M3 20 21 10M3 20 21 16M3 20h18" },
  FibExtensionTwoPoint: { path: "M3 5h18M3 12h18M3 19h18M8 5v14" },
  FibSpeedResistanceFan: { path: "M3 20 21 4M3 20 21 10M3 20 21 16M3 20h18" },
  TrendFibTime: { path: "M4 3v18M8 3v18M14 3v18M22 3v18M4 3 22 21" },
  FibCircles: { path: "M10 14 22 2M2 6a8 8 0 0 1 16 16M6 10a4 4 0 0 1 8 8" },
  FibSpeedResistanceArcs: { path: "M10 14 22 2M2 6a8 8 0 0 1 16 16M6 10a4 4 0 0 1 8 8" },
  FibWedge: { path: "M3 20 12 4l9 16zM3 20h18" },
  FibSpiral: { path: "M12 12a3 3 0 1 0 0 6a6 6 0 1 0 0-12a9 9 0 1 0 0 18" },
  GannFan: { path: "M3 20 21 2M3 20 21 9M3 20 21 15M3 20h18" },
  GannBox: { path: "M3 3h18v18H3zM3 3l18 18M3 21 21 3" },
  GannSquare: { path: "M3 3h18v18H3zM9 3v18M15 3v18M3 9h18M3 15h18M3 21 21 3" },
  Rectangle: { path: "M3 5h18v14H3z" },
  RotatedRectangle: { path: "M2 14 10 4l12 6-8 10z" },
  Ellipse: { path: "M12 5c5 0 9 3 9 7s-4 7-9 7-9-3-9-7 4-7 9-7z" },
  Circle: { path: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z" },
  Triangle: { path: "M12 4 21 20H3z" },
  Path: { path: "M3 20 7 7l5 9 5-5M20 8l-6 2 4 4z" },
  Polyline: { path: "M4 19 9 7l5 9 6-11M2 19a2 2 0 0 0 4 0a2 2 0 0 0 -4 0zM7 7a2 2 0 0 0 4 0a2 2 0 0 0 -4 0zM12 16a2 2 0 0 0 4 0a2 2 0 0 0 -4 0z" },
  Arc: { path: "M3 19a12 12 0 0 1 18 0" },
  Curve: { path: "M3 18c4-12 14-12 18 0" },
  DoubleCurve: { path: "M3 18c3-9 7-9 9 0 2 9 6 9 9 0" },
  PriceRange: { path: "M12 4v16M7 9l5-5 5 5M7 15l5 5 5-5" },
  DateRange: { path: "M4 12h16M9 7l-5 5 5 5M15 7l5 5-5 5" },
  Measure: { path: "M4 16h16M4 12v8M20 12v8M8 4h8M12 4v6" },
  CyclicLines: { path: "M4 4v16M10 4v16M16 4v16M22 4v16" },
  TimeCycles: { path: "M4 12a4 4 0 0 1 8 0 4 4 0 0 0 8 0M4 4v16" },
  SineLine: { path: "M2 12c3-9 6-9 9 0 3 9 6 9 9 0" },
  XABCDPattern: { path: "M3 18 9 4 15 15 21 3M3 18 15 15" },
  ABCDPattern: { path: "M3 18 9 4 15 15 21 3M3 18 15 15" },
  HeadShoulders: { path: "M2 20 5 10 8 17 12 3 16 17 19 10 22 20M3 17h18" },
  ElliottImpulse: { path: "M3 18 7 12 11 15 15 5 21 3M7 12V5M15 5l3 3" },
  ElliottCorrection: { path: "M3 5 8 18l4-7 4 5 5-13M8 18h13" },
  Gartley: { path: "M3 18 9 4 15 15 21 3M3 18 15 15M9 4 21 3" },
  Bat: { path: "M3 18 9 4 15 15 21 3M3 18 15 15 9 4" },
  Butterfly: { path: "M3 18 9 4 15 15 21 3M3 18 21 3" },
  Crab: { path: "M3 18 9 4 15 15 21 3M9 4 15 15M3 18 21 3" },
  Shark: { path: "M3 18 9 4 15 15 21 3M3 18 15 15" },
  Cypher: { path: "M3 18 9 4 15 15 21 3M9 4 21 3" },
  LongPosition: { path: "M2 14h4M6 3h15v17H6zM6 14h15M10 11l3-4 3 4z" },
  ShortPosition: { path: "M2 10h4M6 4h15v17H6zM6 10h15M10 13l3 4 3-4z" },
  Forecast: { path: "M3 18 9 10l4 4 8-10M13 4h8v8" },
  AnchoredVWAP: { path: "M4 4v16M4 15 8 12 12 14 16 8 20 6M2 4h4" },
  Text: { path: "M4 5h16M12 5v14M8 19h8" },
  PriceLabel: { path: "M3 12 8 7h13v10H8z" },
  Callout: { path: "M3 4h18v13H9l-5 4v-4H3z" },
  Note: { path: "M5 3h14v18H5zM8 7h8M8 11h8M8 15h5" },
  Balloon: { path: "M4 4h16v12H9l-5 4v-4H4z" },
  Comment: { path: "M3 5h18v12H9l-6 4z" },
  FlagMark: { path: "M5 21V4h14l-4 4 4 4H5" },
  IconStamp: { path: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 7v5l3 2" },
  ArrowUp: { path: "M12 3v18M6 9l6-6 6 6" },
  ArrowDown: { path: "M12 3v18M6 15l6 6 6-6" },
  ArrowLeft: { path: "M3 12h18M9 6l-6 6 6 6" },
  ArrowRight: { path: "M3 12h18M15 6l6 6-6 6" },
  Brush: { path: "M3 19c4 0 4-8 8-8s4 8 9 4" },
  Highlighter: { path: "M4 16 14 6l4 4-10 10H4z" },
};

/** Small non-tool glyphs shared by the framework adapters' toolbar chrome. */
export const DRAWING_TOOL_UI_ICONS = {
  select: "M5 3l11 7-5 1 3 6-2 1-3-6-3 4z",
  clear: "M5 5l14 14M19 5 5 19",
  trash: "M4 6h16M9 6V4h6v2M7 6l1 14h8l1-14M10 10v6M14 10v6",
  eraser: "M4 16l9-9 5 5-9 9H4zM13 7l2-2 5 5-2 2",
} as const;

const tool = (id: DrawingToolId, label: string): DrawingToolDefinition => ({ id, label });

/**
 * Project B's grouping contract, limited to tools implemented by CandleKit.
 * Adapters should render this definition instead of maintaining their own
 * group/icon mapping.
 */
export const DRAWING_TOOL_GROUPS: readonly DrawingToolGroupDefinition[] = [
  {
    id: "lines",
    label: "Lines",
    icon: "TrendLine",
    sections: [
      { label: "Lines", tools: [tool("TrendLine", "Trend line"), tool("Ray", "Ray"), tool("ExtendedLine", "Extended line"), tool("Arrow", "Arrow"), tool("InfoLine", "Info line"), tool("TrendAngle", "Trend angle")] },
      { label: "Horizontal and vertical", tools: [tool("HorizontalLine", "Horizontal line"), tool("HorizontalRay", "Horizontal ray"), tool("VerticalLine", "Vertical line"), tool("CrossLine", "Cross line")] },
    ],
  },
  {
    id: "channels",
    label: "Channels",
    icon: "ParallelChannel",
    sections: [
      { label: "Channels", tools: [tool("ParallelChannel", "Parallel channel"), tool("FibChannel", "Fibonacci channel"), tool("DisjointChannel", "Disjoint channel"), tool("FlatTopBottom", "Flat top/bottom"), tool("RegressionChannel", "Regression channel")] },
      { label: "Pitchforks", tools: [tool("Pitchfork", "Pitchfork"), tool("SchiffPitchfork", "Schiff pitchfork"), tool("ModifiedSchiffPitchfork", "Modified Schiff pitchfork"), tool("InsidePitchfork", "Inside pitchfork")] },
    ],
  },
  {
    id: "fibonacci",
    label: "Fibonacci & Gann",
    icon: "FibRetracement",
    sections: [
      { label: "Fibonacci", tools: [tool("FibRetracement", "Fibonacci retracement"), tool("FibExtension", "Fibonacci extension"), tool("FibTimeZone", "Fibonacci time zone"), tool("FibFan", "Fibonacci fan"), tool("FibExtensionTwoPoint", "Fibonacci extension (two point)"), tool("FibSpeedResistanceFan", "Fibonacci speed resistance fan"), tool("TrendFibTime", "Trend Fibonacci time"), tool("FibCircles", "Fibonacci circles"), tool("FibSpeedResistanceArcs", "Fibonacci speed resistance arcs"), tool("FibWedge", "Fibonacci wedge"), tool("FibSpiral", "Fibonacci spiral")] },
      { label: "Gann", tools: [tool("GannFan", "Gann fan"), tool("GannBox", "Gann box"), tool("GannSquare", "Gann square")] },
    ],
  },
  {
    id: "shapes",
    label: "Shapes",
    icon: "Rectangle",
    sections: [
      { label: "Shapes", tools: [tool("Rectangle", "Rectangle"), tool("RotatedRectangle", "Rotated rectangle"), tool("Ellipse", "Ellipse"), tool("Circle", "Circle"), tool("Triangle", "Triangle")] },
      { label: "Paths", tools: [tool("Path", "Path"), tool("Polyline", "Polyline"), tool("Arc", "Arc"), tool("Curve", "Curve"), tool("DoubleCurve", "Double curve")] },
    ],
  },
  { id: "cycles", label: "Cycles", icon: "SineLine", sections: [{ tools: [tool("CyclicLines", "Cyclic lines"), tool("TimeCycles", "Time cycles"), tool("SineLine", "Sine line")] }] },
  {
    id: "patterns",
    label: "Patterns",
    icon: "XABCDPattern",
    sections: [
      { label: "Patterns and waves", tools: [tool("XABCDPattern", "XABCD pattern"), tool("ABCDPattern", "ABCD pattern"), tool("HeadShoulders", "Head and shoulders"), tool("ElliottImpulse", "Elliott impulse"), tool("ElliottCorrection", "Elliott correction")] },
      { label: "Harmonic patterns", tools: [tool("Gartley", "Gartley"), tool("Bat", "Bat"), tool("Butterfly", "Butterfly"), tool("Crab", "Crab"), tool("Shark", "Shark"), tool("Cypher", "Cypher")] },
    ],
  },
  { id: "positions", label: "Forecasting", icon: "LongPosition", sections: [{ tools: [tool("LongPosition", "Long position"), tool("ShortPosition", "Short position"), tool("Forecast", "Forecast")] }] },
  { id: "volume", label: "Volume studies", icon: "AnchoredVWAP", sections: [{ tools: [tool("AnchoredVWAP", "Anchored VWAP")] }] },
  { id: "measure", label: "Measurers", icon: "Measure", sections: [{ tools: [tool("PriceRange", "Price range"), tool("DateRange", "Date range"), tool("Measure", "Measure")] }] },
  {
    id: "marks",
    label: "Arrows & notes",
    icon: "Text",
    sections: [
      { label: "Text and notes", tools: [tool("Text", "Text"), tool("PriceLabel", "Price label"), tool("Callout", "Callout"), tool("Note", "Note"), tool("Balloon", "Balloon"), tool("Comment", "Comment")] },
      { label: "Marks", tools: [tool("FlagMark", "Flag mark"), tool("IconStamp", "Icon stamp")] },
      { label: "Arrows", tools: [tool("ArrowUp", "Arrow up"), tool("ArrowDown", "Arrow down"), tool("ArrowLeft", "Arrow left"), tool("ArrowRight", "Arrow right")] },
      { label: "Brushes", tools: [tool("Brush", "Brush"), tool("Highlighter", "Highlighter")] },
    ],
  },
];
