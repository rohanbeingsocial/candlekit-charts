/**
 * usePanel — access the current panel instance + updateConfig inside a
 * workspace tab.
 *
 * The panel component receives these as props from FlexLayoutAdapter;
 * this hook is a convenience for deeply-nested children.
 */

import { useContext } from "react";
import { PanelContext } from "../panels/PanelContext";
import type { PanelInstance } from "../../../workspace";

export interface UsePanelResult<TConfig extends Record<string, unknown> = Record<string, unknown>> {
  instance: PanelInstance<TConfig>;
  updateConfig: (next: Partial<TConfig>) => void;
}

export function usePanel<TConfig extends Record<string, unknown> = Record<string, unknown>>(): UsePanelResult<TConfig> {
  const ctx = useContext(PanelContext);
  if (!ctx) throw new Error("usePanel must be used inside a workspace panel");
  return ctx as UsePanelResult<TConfig>;
}
