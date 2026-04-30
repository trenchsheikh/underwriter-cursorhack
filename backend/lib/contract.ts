/**
 * UnderWriter — backend ↔ frontend contract.
 *
 * Both sides import from this file. Changes require both halves of
 * the team to agree. (See backend/docs/Backend.md §2.)
 */

// ----- Domain ------------------------------------------------------

export type DeskId =
  | "company"
  | "founder"
  | "investor"
  | "round"
  | "mandate"
  | "wire";

export type DeskNumber = "01" | "02" | "03" | "04" | "05" | "06";

export type Status = "idle" | "streaming" | "pass" | "flag" | "block";

export type SourceTag =
  | "specter"
  | "companies-house"
  | "opensanctions"
  | "whois"
  | "mandate"
  | "spa"
  | "linkedin";

export interface Citation {
  source: SourceTag;
  ref: string;
  url?: string;
  detail?: string;
  cached?: boolean;
}

export interface DeskFinding {
  desk: DeskId;
  number: DeskNumber;
  title: string;
  status: Exclude<Status, "idle" | "streaming">;
  confidence: number;
  durationMs: number;
  primary: string;
  facts: string[];
  citations: Citation[];
  raw?: unknown;
}

export interface Verdict {
  action: "proceed" | "review" | "hold";
  confidence: number;
  summary: string;
  blockingDesk?: DeskId;
  blockingReason?: string;
}

// ----- Run lifecycle ----------------------------------------------

export interface RunRequestFile {
  name: string;
  mime: string;
  size: number;
  /** Either a fixture id ("clean-acme") or an uploaded blob id. */
  ref: string;
}

export interface RunRequest {
  prompt: string;
  files: RunRequestFile[];
  fixtureSeed?: "clean-acme" | "bec-acme" | "dex-meetdex";
}

export interface RunInit {
  runId: string;
  startedAt: string;
  mandateVersion: number;
  fundId: string;
}

export type RunEvent =
  | { type: "run.init"; run: RunInit }
  | { type: "desk.start"; desk: DeskId }
  | { type: "desk.progress"; desk: DeskId; message: string }
  | { type: "desk.citation"; desk: DeskId; citation: Citation }
  | { type: "desk.resolved"; finding: DeskFinding }
  | { type: "verdict"; verdict: Verdict }
  | { type: "memo.ready"; memoId: string }
  | { type: "error"; desk?: DeskId; message: string };

// ----- Memo --------------------------------------------------------

export interface MemoData {
  runId: string;
  fund: { name: string; id: string };
  deal: {
    company: string;
    round: string;
    amountUsd: number;
    proRataPct?: number;
  };
  verdict: Verdict;
  findings: DeskFinding[];
  summary: string;
  recommendation: string;
  requiredActions: string[];
  generatedAt: string;
}

// ----- Amendment ---------------------------------------------------

export interface OverrideContext {
  runId: string;
  blockingDesk: DeskId;
  blockingReason: string;
  /** Mandate clause path that fired the block, e.g. "wire_safety §6.2". */
  clause: string;
  /** Free-text rationale provided by the GP performing the override. */
  rationale?: string;
}

export interface AmendmentDraft {
  runId: string;
  branch: string;
  diff: string;
  prTitle: string;
  prBody: string;
  prUrl?: string;
}
