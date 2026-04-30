/**
 * FE-local types that don't live on the backend contract.
 *
 * Everything that crosses the wire (DeskFinding, Citation, Verdict,
 * RunEvent, MemoData, OverrideContext, AmendmentDraft) is in
 * `app/lib/contract.ts`. This file only holds shapes that stay inside
 * the FE.
 */

export type Theme = "dark" | "light";
export type Route = "mandate" | "run" | "memo";

export interface Attachment {
  name: string;
  size: string;
  icon: "file-text" | "mail";
}

/**
 * The Mandate-screen amendment-log item.
 *
 * The backend doesn't expose a list of amendments — the FE keeps this
 * array in memory for the session (seeded from `INITIAL_AMENDMENTS` in
 * `state/initial.ts`, mutated by either the Mandate "New PR" modal or
 * the Run "Override and amend" flow).
 */
export interface Amendment {
  id: number;
  date: string;
  author: string;
  summary: string;
  lines: string;
  diff: string[];
  active?: boolean;
  fresh?: boolean;
  attachments?: Attachment[];
  /** Populated when the amendment came from a real backend draft. */
  prUrl?: string;
}
