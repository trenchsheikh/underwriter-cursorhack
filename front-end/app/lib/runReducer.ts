"use client";

/**
 * Reducer for the Diligence Run lifecycle.
 *
 * The FE keeps its existing 6-element-array layout for the desk grid
 * (so the visual code in RunScreen / DeskTile stays simple), but the
 * source of truth is `findings: Record<DeskId, DeskFinding | null>`.
 * Tiles render in `DESK_ORDER` order, looking up by id.
 *
 * Actions split into two groups:
 *   - Client-only (typewriter, file pills, scenario pick, run reset).
 *   - SSE-driven: `applyEvent(state, evt)` maps every RunEvent variant
 *     onto the state. Unknown event types fall through to a
 *     `RUN_UNKNOWN_EVENT` action that logs but doesn't break the run —
 *     the contract is allowed to grow.
 */

import type {
  DeskFinding,
  DeskId,
  RunEvent,
  Status,
  Verdict,
} from "./contract";
import { DESK_ORDER, deskIndex } from "./deskMeta";

/* ------------------------------- types ------------------------------- */

export type Mode = "idle" | "typing" | "ready" | "running" | "resolved";

export interface PromptFile {
  name: string;
  mime: string;
  size: number;
  /** Either a fixture id ("clean-acme") or an uploaded blob id. */
  ref: string;
  /** Display-only: KB/MB label rendered in the file pill. */
  sizeLabel: string;
  /** Display-only: icon variant for the pill. */
  icon: "file-text" | "mail";
}

export type Scenario = "clean" | "bec";

export interface RunState {
  mode: Mode;
  scenario: Scenario | null;

  // Composition (pre-run)
  prompt: string;
  files: PromptFile[];

  // Run lifecycle
  runId: string | null;
  startedAt: string | null;
  mandateVersion: number | null;
  fundId: string | null;
  runStartLocal: number | null; // Date.now() when stream opened (for elapsed)

  // Per-desk state
  deskStates: Record<DeskId, Status>;
  findings: Record<DeskId, DeskFinding | null>;
  progressMessages: Partial<Record<DeskId, string>>;
  /** Bumped on every desk.citation; UI uses to count "shown so far". */
  citationsShown: Record<DeskId, number>;

  // Run outcome
  verdict: Verdict | null;
  memoId: string | null;

  // Errors
  errors: { desk?: DeskId; message: string }[];
}

export const INITIAL_RUN_STATE: RunState = {
  mode: "idle",
  scenario: null,
  prompt: "",
  files: [],

  runId: null,
  startedAt: null,
  mandateVersion: null,
  fundId: null,
  runStartLocal: null,

  deskStates: makeDeskRecord<Status>("idle"),
  findings: makeDeskRecord<DeskFinding | null>(null),
  progressMessages: {},
  citationsShown: makeDeskRecord<number>(0),

  verdict: null,
  memoId: null,

  errors: [],
};

function makeDeskRecord<T>(initial: T): Record<DeskId, T> {
  const out = {} as Record<DeskId, T>;
  for (const id of DESK_ORDER) out[id] = initial;
  return out;
}

/* ------------------------------ actions ------------------------------ */

export type RunAction =
  // Client-only
  | { type: "LOAD_SCENARIO_START"; scenario: Scenario }
  | { type: "PROMPT_TOKEN"; text: string }
  | { type: "PROMPT_EDIT"; text: string }
  | { type: "FILE_ATTACHED"; file: PromptFile; isLast: boolean }
  | { type: "FILE_REMOVED"; index: number }
  | { type: "RUN_REQUESTED" } // optimistic; mode → running before run.init lands
  | { type: "RESET" }
  // SSE-driven
  | { type: "APPLY_EVENT"; event: RunEvent }
  | { type: "STREAM_CLOSED" };

/* ----------------------------- reducer ------------------------------- */

export function runReducer(state: RunState, action: RunAction): RunState {
  switch (action.type) {
    case "LOAD_SCENARIO_START":
      return {
        ...INITIAL_RUN_STATE,
        mode: "typing",
        scenario: action.scenario,
      };

    case "PROMPT_TOKEN":
    case "PROMPT_EDIT":
      return { ...state, prompt: action.text };

    case "FILE_ATTACHED": {
      const files = [...state.files, action.file];
      return {
        ...state,
        files,
        mode: action.isLast ? "ready" : state.mode,
      };
    }

    case "FILE_REMOVED": {
      const files = state.files.filter((_, i) => i !== action.index);
      return { ...state, files };
    }

    case "RUN_REQUESTED":
      return {
        ...state,
        mode: "running",
        runStartLocal: Date.now(),
        deskStates: makeDeskRecord<Status>("streaming"),
        findings: makeDeskRecord<DeskFinding | null>(null),
        citationsShown: makeDeskRecord<number>(0),
        progressMessages: {},
        verdict: null,
        memoId: null,
        errors: [],
      };

    case "STREAM_CLOSED":
      // The contract has no run.complete event. We derive the transition:
      // if we already have a verdict, the run is resolved; otherwise stay
      // put (the stream may have closed mid-flight; an `error` event
      // should have arrived too).
      return state.verdict ? { ...state, mode: "resolved" } : state;

    case "RESET":
      return INITIAL_RUN_STATE;

    case "APPLY_EVENT":
      return applyEvent(state, action.event);

    default:
      return state;
  }
}

/* ------------------------- SSE event reducer ------------------------- */

function applyEvent(state: RunState, evt: RunEvent): RunState {
  switch (evt.type) {
    case "run.init":
      return {
        ...state,
        runId: evt.run.runId,
        startedAt: evt.run.startedAt,
        mandateVersion: evt.run.mandateVersion,
        fundId: evt.run.fundId,
        // run.init may arrive before RUN_REQUESTED ran (rare); ensure
        // mode is at least "running" and the streaming markers are set.
        mode: state.mode === "ready" || state.mode === "running"
          ? "running"
          : state.mode,
        runStartLocal: state.runStartLocal ?? Date.now(),
        deskStates: state.runStartLocal
          ? state.deskStates
          : makeDeskRecord<Status>("streaming"),
      };

    case "desk.start":
      return {
        ...state,
        deskStates: { ...state.deskStates, [evt.desk]: "streaming" },
      };

    case "desk.progress":
      return {
        ...state,
        progressMessages: { ...state.progressMessages, [evt.desk]: evt.message },
      };

    case "desk.citation": {
      const existing = state.findings[evt.desk];
      // If desk.resolved hasn't landed yet, stash the citation onto a
      // shadow finding so the tile can render it. When desk.resolved
      // arrives, its citations[] replaces this stash.
      const shadow: DeskFinding = existing ?? {
        desk: evt.desk,
        number: "01", // placeholder — overwritten by desk.resolved
        title: "",
        status: "pass", // placeholder
        confidence: 0,
        durationMs: 0,
        primary: "",
        facts: [],
        citations: [],
      };
      const findings: Record<DeskId, DeskFinding | null> = {
        ...state.findings,
        [evt.desk]: { ...shadow, citations: [...shadow.citations, evt.citation] },
      };
      return {
        ...state,
        findings,
        citationsShown: {
          ...state.citationsShown,
          [evt.desk]: state.citationsShown[evt.desk] + 1,
        },
      };
    }

    case "desk.resolved": {
      const f = evt.finding;
      // Preserve any citations that streamed in before the resolution
      // (the backend's resolved finding is authoritative, but it's
      // tolerant for the contract to ship resolved without the
      // pre-streamed citations).
      const prior = state.findings[f.desk];
      const merged: DeskFinding = {
        ...f,
        citations:
          f.citations.length > 0
            ? f.citations
            : prior?.citations ?? [],
      };
      return {
        ...state,
        findings: { ...state.findings, [f.desk]: merged },
        deskStates: { ...state.deskStates, [f.desk]: f.status },
        citationsShown: {
          ...state.citationsShown,
          [f.desk]: merged.citations.length,
        },
      };
    }

    case "verdict":
      return { ...state, verdict: evt.verdict };

    case "memo.ready":
      return {
        ...state,
        memoId: evt.memoId,
        // Treat memo.ready as the terminal signal; the stream will
        // close right after. mode → resolved here so the verdict bar
        // and modal trigger fire promptly without waiting on
        // STREAM_CLOSED.
        mode: state.verdict ? "resolved" : state.mode,
      };

    case "error":
      return {
        ...state,
        errors: [...state.errors, { desk: evt.desk, message: evt.message }],
      };

    default: {
      // Unknown event variant. Log but don't break — the contract is
      // allowed to grow additively.
      // eslint-disable-next-line no-console
      console.warn("[runReducer] unknown SSE event", evt);
      return state;
    }
  }
}

/* ------------------------- selector helpers -------------------------- */

/** True if all six desks have resolved (status not idle/streaming). */
export function allDesksResolved(state: RunState): boolean {
  return DESK_ORDER.every((id) => {
    const s = state.deskStates[id];
    return s === "pass" || s === "flag" || s === "block";
  });
}

/** Number of desks that have resolved (used by VerdictBar). */
export function resolvedCount(state: RunState): number {
  let n = 0;
  for (const id of DESK_ORDER) {
    const s = state.deskStates[id];
    if (s === "pass" || s === "flag" || s === "block") n++;
  }
  return n;
}

/** Index of a DeskId in the grid (0..5). */
export { deskIndex };
