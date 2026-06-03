/**
 * Shared indicator registry for the built-in ChartPanel.
 *
 * Defaults to candlekit's own MIT catalog. A host can swap in a richer registry
 * (e.g. the 400+ `@candlekit/charts/indicators-tv` set) once at startup, before
 * panels mount, so every ChartPanel's Indicators dropdown lists it — without the
 * core panel taking a dependency on any third-party indicator runtime.
 */

import type { IndicatorRegistry } from "../../../indicators/registry";
import { createBuiltinRegistry } from "../../../indicators/builtin";

let registry: IndicatorRegistry | null = null;

/** Override the registry every built-in ChartPanel reads. Call before mount. */
export function setWorkspaceIndicatorRegistry(next: IndicatorRegistry): void {
  registry = next;
}

/** The active registry (built-in catalog by default). */
export function getWorkspaceIndicatorRegistry(): IndicatorRegistry {
  if (!registry) registry = createBuiltinRegistry();
  return registry;
}
