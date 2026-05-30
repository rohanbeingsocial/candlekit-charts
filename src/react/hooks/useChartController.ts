import { useEffect, useRef, useState } from "react";
import { ChartController, type ChartControllerOptions } from "../../chart/ChartController";

/**
 * Create a {@link ChartController} bound to a container element. The controller
 * is created once on mount and destroyed on unmount; option *changes* are
 * applied imperatively via the controller (e.g. `controller.setTheme(...)`),
 * not by recreating it.
 */
export function useChartController(options: ChartControllerOptions = {}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [controller, setController] = useState<ChartController | null>(null);
  // Keep the latest options without retriggering the create effect.
  const optsRef = useRef(options);
  optsRef.current = options;

  useEffect(() => {
    if (!containerRef.current) return;
    const c = new ChartController(containerRef.current, optsRef.current);
    setController(c);
    return () => {
      c.destroy();
      setController(null);
    };
  }, []);

  return { containerRef, controller };
}
