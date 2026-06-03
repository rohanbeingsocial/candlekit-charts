/**
 * usePageTheme — reflect the document's light/dark mode into React.
 *
 * Reads `<html data-theme="…">` (falling back to the `.dark` class) and updates
 * when it changes via a MutationObserver. Lets chart panels follow a global
 * theme toggle without threading a prop through every component. SSR-safe
 * (defaults to "dark" when there's no document).
 */

import { useEffect, useState } from "react";

export type PageTheme = "light" | "dark";

function read(): PageTheme {
  if (typeof document === "undefined") return "dark";
  const root = document.documentElement;
  const attr = root.getAttribute("data-theme");
  if (attr === "light" || attr === "dark") return attr;
  return root.classList.contains("dark") ? "dark" : "light";
}

export function usePageTheme(): PageTheme {
  const [theme, setTheme] = useState<PageTheme>(read);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    const sync = () => setTheme(read());
    sync();
    const obs = new MutationObserver(sync);
    obs.observe(root, { attributes: true, attributeFilter: ["data-theme", "class"] });
    return () => obs.disconnect();
  }, []);

  return theme;
}
