"use client";

import { useEffect, useState } from "react";

/**
 * Returns elapsed seconds (string with one decimal) since `active` flipped true.
 * Resets to 0 each time `active` becomes true; stays frozen at last value when false.
 */
export function useElapsed(active: boolean): string {
  const [t, setT] = useState("0.0");
  useEffect(() => {
    if (!active) return;
    setT("0.0");
    const start = performance.now();
    const id = setInterval(
      () => setT(((performance.now() - start) / 1000).toFixed(1)),
      100,
    );
    return () => clearInterval(id);
  }, [active]);
  return t;
}
