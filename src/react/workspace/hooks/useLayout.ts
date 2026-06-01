/**
 * useLayout — access layout save/load/reset APIs.
 */

import { useCallback } from "react";
import { useWorkspace } from "./useWorkspace";

export interface UseLayoutResult {
  saveLayout: (name: string) => Promise<void>;
  loadLayout: (name: string) => Promise<void>;
  listLayouts: () => Promise<readonly { id: string; name: string; updatedAt: string }[]>;
  deleteLayout: (name: string) => Promise<void>;
  resetLayout: () => void;
  exportLayout: () => unknown;
  importLayout: (blob: unknown) => void;
}

export function useLayout(): UseLayoutResult {
  const workspace = useWorkspace();

  return {
    saveLayout: useCallback((name: string) => workspace.saveLayout(name), [workspace]),
    loadLayout: useCallback((name: string) => workspace.loadLayout(name), [workspace]),
    listLayouts: useCallback(() => workspace.listLayouts(), [workspace]),
    deleteLayout: useCallback((name: string) => workspace.deleteLayout(name), [workspace]),
    resetLayout: useCallback(() => workspace.resetLayout(), [workspace]),
    exportLayout: useCallback(() => workspace.exportLayout(), [workspace]),
    importLayout: useCallback((blob: unknown) => workspace.importLayout(blob), [workspace]),
  };
}
