"use client";

/**
 * Map contract `SourceTag` → existing CSS class name on the cite-row.
 *
 * The FE's CSS (app/globals.css) uses `cite-row.specter`, `cite-row.ch`,
 * `cite-row.sanctions`, `cite-row.whois`, `cite-row.mandate`,
 * `cite-row.block`. The contract's vocabulary differs slightly. Keep
 * the styling intact by mapping at render time.
 *
 * Unknown tags fall back to `cite-row.mandate` (vellum), which is the
 * neutral "internal source" colour in the design system.
 */

import type { SourceTag } from "./contract";

export function citeCssClass(source: SourceTag | string): string {
  switch (source) {
    case "specter":          return "specter";
    case "companies-house":  return "ch";
    case "opensanctions":    return "sanctions";
    case "whois":            return "whois";
    case "mandate":          return "mandate";
    case "spa":              return "mandate";  // vellum
    case "linkedin":         return "specter";  // share specter blue
    default:                 return "mandate";
  }
}
