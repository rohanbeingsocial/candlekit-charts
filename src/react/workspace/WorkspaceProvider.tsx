/**
 * WorkspaceProvider — mounts the workspace context.
 *
 * Usage:
 *   <WorkspaceProvider workspace={workspace}>
 *     <WorkspaceShell />
 *   </WorkspaceProvider>
 */

import type { ReactNode } from "react";
import { WorkspaceContext } from "./WorkspaceContext";
import type { WorkspaceManager } from "../../workspace";

export interface WorkspaceProviderProps {
  workspace: WorkspaceManager;
  children: ReactNode;
}

export function WorkspaceProvider({ workspace, children }: WorkspaceProviderProps) {
  return (
    <WorkspaceContext.Provider value={workspace}>
      {children}
    </WorkspaceContext.Provider>
  );
}
