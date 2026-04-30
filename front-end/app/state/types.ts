/**
 * Mandate app — shared state types.
 *
 * The Mandate screen reads/writes:
 *   - theme  (global, lives on App)
 *   - route  (global, lives on App)
 *   - amendments (global, lives on App — Mandate adds, future Run/Memo will read)
 *   - toast  (global, lives on App)
 *
 * Mandate also has internal local state (which PR diff is open, modal open?).
 * That stays local to the screen.
 */

export type Theme = "dark" | "light";
export type Route = "mandate" | "run" | "memo";

export interface Attachment {
  name: string;
  size: string;
  icon: "file-text" | "mail";
}

export interface Amendment {
  id: number;
  date: string;          // YYYY-MM-DD
  author: string;
  summary: string;
  lines: string;         // e.g. "+1", "−2", "~1"
  diff: string[];        // raw diff lines, prefixed with " ", "+", "-"
  active?: boolean;      // green active marker on the rail
  fresh?: boolean;       // animate-in flag for newly merged PRs
  attachments?: Attachment[];
}
