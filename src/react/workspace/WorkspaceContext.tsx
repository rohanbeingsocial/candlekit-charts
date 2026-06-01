/**
 * WorkspaceContext — React context for the active WorkspaceManager.
 */

import { createContext } from "react";
import type { WorkspaceManager } from "../../workspace";

export const WorkspaceContext = createContext<WorkspaceManager | null>(null);
