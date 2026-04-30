/**
 * Mandate app — shared state types.
 *
 * Centralised on the App shell (page.tsx):
 *   - theme       : dark | light
 *   - route       : which screen is showing
 *   - amendments  : the PR/amendment log (read by Mandate; mutated by both
 *                   the Mandate "New PR" flow and the Run "Override and amend"
 *                   flow)
 *   - runState    : everything about the current Diligence Run; read by Memo
 *                   so the verdict reflects whichever scenario was last run
 *   - toast       : transient bottom-center message
 *
 * Anything purely about how a single component looks (which diff is open,
 * whether a modal is showing) stays local to that component.
 */

import type { IconName } from "../components/Icon";

export type Theme = "dark" | "light";
export type Route = "mandate" | "run" | "memo";

export interface Attachment {
  name: string;
  size: string;
  icon: "file-text" | "mail";
}

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
}

/* ============== Run state ============== */

export type RunMode = "idle" | "typing" | "ready" | "running" | "resolved";
export type Scenario = "clean" | "bec";
export type DeskState = "idle" | "streaming" | "pass" | "flag" | "block";

export type CiteSource =
  | "specter" | "ch" | "sanctions" | "whois" | "mandate" | "block";

export interface Cite {
  src: CiteSource;
  text: string;
  link?: boolean;
}

export interface Desk {
  n: string;        // "01" .. "06"
  name: string;
  icon: IconName;
  primary: string;
  facts: string;
  cites: Cite[];
  conf: string;     // "0.94"
  dur: string;      // "4.2s"
  delay: number;    // ms after start of run that this desk resolves (full-scale)
  status: "pass" | "flag" | "block";
}

export interface ScenarioFixture {
  desks: Desk[];
}

export interface PromptFile {
  name: string;
  size: string;
  icon: "file-text" | "mail";
}

export interface RunState {
  mode: RunMode;
  scenario: Scenario | null;
  prompt: string;
  files: PromptFile[];
  deskStates: DeskState[];
  citesShown: number[];
  runStart: number | null;
}
