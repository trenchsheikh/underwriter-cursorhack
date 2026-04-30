"use client";

/**
 * Render-only formatters that bridge the contract's number/string
 * representations and the FE's existing visual style.
 *
 * Why a separate file: contract field renames (e.g. `confidence: number`
 * → `confidence: string` again) only touch this file, not every tile
 * and modal that displays the value.
 */

import type { Citation } from "./contract";

/** 0.94 → "0.94". Tolerates strings already pre-formatted by the backend. */
export function formatConfidence(c: number | string | null | undefined): string {
  if (c == null) return "";
  if (typeof c === "string") return c;
  return c.toFixed(2);
}

/** 4200 → "4.2s". Tolerates a pre-formatted string. */
export function formatDuration(ms: number | string | null | undefined): string {
  if (ms == null) return "";
  if (typeof ms === "string") return ms;
  return `${(ms / 1000).toFixed(1)}s`;
}

/** Display text for a citation row: prefer `detail`, fall back to `ref`. */
export function citeText(c: Citation): string {
  return c.detail ?? c.ref;
}

/** Whether the citation should render an external-link affordance. */
export function citeHasLink(c: Citation): boolean {
  return Boolean(c.url);
}
