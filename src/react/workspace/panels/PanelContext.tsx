/**
 * PanelContext — React context scoped to a single workspace tab.
 */

import { createContext } from "react";
import type { PanelInstance } from "../../../workspace";

export const PanelContext = createContext<{
  instance: PanelInstance;
  updateConfig: (next: Partial<Record<string, unknown>>) => void;
} | null>(null);
