/**
 * useWorkspace — access the active WorkspaceManager from React context.
 */

import { useContext } from "react";
import { WorkspaceContext } from "../WorkspaceContext";
import type { WorkspaceManager } from "../../../workspace";

export function useWorkspace(): WorkspaceManager {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error("useWorkspace must be used inside <WorkspaceProvider>");
  return ctx;
}
