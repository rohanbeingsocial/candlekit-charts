/**
 * LayoutEngine — abstraction over the underlying layout library.
 *
 * The engine knows how to:
 *   - build a default layout tree
 *   - validate an imported tree
 *   - extract panel instances from a tree
 *
 * FlexLayout specifics live in the React adapter; this module stays
 * framework-agnostic.
 */

import type { LayoutTreeBlob, PanelInstance } from "./types";

export interface LayoutEngine {
  /** Validate that a blob is a usable layout tree. */
  validate(blob: unknown): boolean;
  /** Extract panel instances from a tree. */
  extractPanels(tree: LayoutTreeBlob): Record<string, PanelInstance>;
}

/** No-op engine for consumers who bring their own layout impl. */
export class PassthroughLayoutEngine implements LayoutEngine {
  validate(blob: unknown): boolean {
    return blob != null && typeof blob === "object";
  }

  extractPanels(): Record<string, PanelInstance> {
    return {};
  }
}
