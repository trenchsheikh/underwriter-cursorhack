"use client";

import { useEffect, useReducer, useRef, useState } from "react";
import { Icon } from "./Icon";
import { DeskTile } from "./DeskTile";
import { DeskDrawer } from "./DeskDrawer";
import { VerdictBar } from "./VerdictBar";
import { BlockModal } from "./BlockModal";
import { AmendmentPR } from "./AmendmentPR";
import { useElapsed } from "./useElapsed";
import {
  DEMO_PROMPT,
  DEMO_FILES_BEC,
  DEMO_FILES_CLEAN,
} from "../state/fixtures";
import type { Amendment, Route } from "../state/types";
import type { DeskId, OverrideContext } from "../lib/contract";
import {
  INITIAL_RUN_STATE,
  resolvedCount as countResolved,
  runReducer,
  type Scenario,
} from "../lib/runReducer";
import { DESK_META, DESK_ORDER } from "../lib/deskMeta";
import { startRun } from "../lib/run";

interface Props {
  go: (r: Route) => void;
  setToast: (s: string) => void;
  /** Pushes a fresh amendment onto the global log. */
  onMergeAmendment: (a: Amendment) => void;
  /** Next available PR id (FE-local — backend doesn't manage these yet). */
  nextAmendmentId: number;
  /** Latest run id; lifted up so MemoScreen can read it after navigation. */
  publishRunId: (id: string | null) => void;
  /** Latest verdict; same reason. */
  publishVerdict: (action: "proceed" | "review" | "hold" | null) => void;
}

export function RunScreen({
  go,
  setToast,
  onMergeAmendment,
  nextAmendmentId,
  publishRunId,
  publishVerdict,
}: Props) {
  const [state, dispatch] = useReducer(runReducer, INITIAL_RUN_STATE);
  const [drawer, setDrawer] = useState<DeskId | null>(null);
  const [showBlockModal, setShowBlockModal] = useState(false);
  const [showAmendPR, setShowAmendPR] = useState(false);

  // Cancel handle for the active SSE stream.
  const abortRef = useRef<(() => void) | null>(null);
  // BlockModal opens 600ms after the BEC verdict arrives — same pacing as before.
  const blockModalTimerRef = useRef<number | null>(null);

  const { mode, scenario, prompt, files, runId, mandateVersion, fundId, startedAt } = state;
  const totalElapsed = useElapsed(mode === "running");
  const resolvedCount = countResolved(state);

  /* ----------------------------------------------------------- */
  /* Scenario load: typewriter + staggered file pills (client)   */
  /* ----------------------------------------------------------- */

  const loadScenario = (sc: Scenario) => {
    if (mode === "typing" || mode === "running") return;

    dispatch({ type: "LOAD_SCENARIO_START", scenario: sc });

    let i = 0;
    const tick = () => {
      i++;
      dispatch({ type: "PROMPT_TOKEN", text: DEMO_PROMPT.slice(0, i) });
      if (i < DEMO_PROMPT.length) {
        window.setTimeout(tick, 12);
      } else {
        const targetFiles = sc === "clean" ? DEMO_FILES_CLEAN : DEMO_FILES_BEC;
        targetFiles.forEach((f, idx) => {
          window.setTimeout(() => {
            dispatch({
              type: "FILE_ATTACHED",
              file: f,
              isLast: idx === targetFiles.length - 1,
            });
          }, 120 + idx * 80);
        });
      }
    };
    window.setTimeout(tick, 80);
  };

  /* ----------------------------------------------------------- */
  /* Run diligence: POST /api/run, pipe SSE into reducer         */
  /* ----------------------------------------------------------- */

  const runDiligence = () => {
    if (mode !== "ready") return;

    // Optimistic transition; run.init from the backend will refine ids.
    dispatch({ type: "RUN_REQUESTED" });

    const fixtureSeed = scenario === "clean" ? "clean-acme" : "bec-acme";
    const { abort } = startRun(
      {
        prompt,
        files: files.map(({ name, mime, size, ref }) => ({ name, mime, size, ref })),
        fixtureSeed,
      },
      (event) => dispatch({ type: "APPLY_EVENT", event }),
    );
    abortRef.current = abort;
  };

  // Cancel SSE on unmount.
  useEffect(() => () => abortRef.current?.(), []);

  // Side effects: publish runId/verdict upward; trigger BLOCK modal on hold.
  useEffect(() => {
    publishRunId(state.runId);
  }, [state.runId, publishRunId]);

  useEffect(() => {
    publishVerdict(state.verdict?.action ?? null);
    if (!state.verdict) return;
    if (state.verdict.action === "hold") {
      blockModalTimerRef.current = window.setTimeout(
        () => setShowBlockModal(true),
        600,
      );
      return () => {
        if (blockModalTimerRef.current != null) {
          window.clearTimeout(blockModalTimerRef.current);
        }
      };
    }
  }, [state.verdict, publishVerdict]);

  // Surface run-level errors via toast.
  const errCount = state.errors.length;
  useEffect(() => {
    if (errCount === 0) return;
    const last = state.errors[errCount - 1];
    if (!last.desk) {
      setToast(`run failed · ${last.message}`);
      window.setTimeout(() => setToast(""), 2400);
    }
  }, [errCount, state.errors, setToast]);

  /* ----------------------------------------------------------- */
  /* Header / metadata                                            */
  /* ----------------------------------------------------------- */

  const headerRunId = runId ?? "—";
  const headerStartedAt = startedAt ?? "—";
  const headerMandateVersion = mandateVersion != null ? `v ${mandateVersion}` : "v —";
  const headerFundId = fundId ?? "—";

  const copyRunId = () => {
    if (!runId) return;
    navigator.clipboard?.writeText(runId);
    setToast(`copied · ${runId}`);
    window.setTimeout(() => setToast(""), 1400);
  };

  return (
    <div
      style={{
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        position: "relative",
      }}
    >
      {/* Run metadata header */}
      <div
        style={{
          padding: "12px 32px",
          borderBottom: "1px solid var(--border-subtle)",
          fontFamily: "var(--font-mono)",
          fontSize: 11,
          color: "var(--ink-tertiary)",
          display: "flex",
          alignItems: "center",
          gap: 12,
          flexShrink: 0,
          background: "var(--surface-0)",
        }}
      >
        <span>RUN</span>
        <button
          className="mono"
          style={{
            color: "var(--ink-secondary)",
            cursor: runId ? "pointer" : "default",
            padding: 0,
            background: "none",
            border: "none",
            fontSize: 11,
            opacity: runId ? 1 : 0.5,
          }}
          onClick={copyRunId}
          title={runId ? "copy run id" : ""}
        >
          {headerRunId}
        </button>
        <span>·</span>
        <span>{headerStartedAt}</span>
        <span>·</span>
        <span>MANDATE {headerMandateVersion}</span>
        <span>·</span>
        <span>{headerFundId}</span>
      </div>

      {/* PROMPT ZONE */}
      <div
        style={{
          padding: "20px 32px 24px",
          borderBottom: "1px solid var(--border-subtle)",
          flexShrink: 0,
        }}
      >
        <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
          <div style={{ flex: 1 }}>
            <textarea
              value={prompt}
              onChange={(e) =>
                dispatch({ type: "PROMPT_EDIT", text: e.target.value })
              }
              placeholder={
                "e.g. Wire $2M to Acme Robotics for their Series A. Lead is Sequoia.\n50% pro-rata of our $4M allocation. SPA and wire instructions attached."
              }
              rows={3}
              style={{
                width: "100%",
                resize: "none",
                background: "var(--surface-1)",
                border: "1px solid var(--border-default)",
                borderRadius: 6,
                padding: 16,
                fontFamily: "var(--font-mono)",
                fontSize: 14,
                lineHeight: "20px",
                color: "var(--ink-primary)",
              }}
              onFocus={(e) =>
                (e.target.style.borderColor = "var(--border-strong)")
              }
              onBlur={(e) =>
                (e.target.style.borderColor = "var(--border-default)")
              }
            />

            {files.length > 0 && (
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 8,
                  marginTop: 12,
                }}
              >
                {files.map((f, i) => (
                  <span
                    key={`${f.ref}-${i}`}
                    className="fade-up"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 8,
                      background: "var(--surface-2)",
                      borderRadius: 2,
                      padding: "6px 10px",
                      fontFamily: "var(--font-mono)",
                      fontSize: 11,
                      color: "var(--ink-secondary)",
                    }}
                  >
                    <Icon name={f.icon} size={12} />
                    <span>{f.name}</span>
                    <span style={{ color: "var(--ink-tertiary)" }}>
                      · {f.sizeLabel}
                    </span>
                    <button
                      type="button"
                      onClick={() => dispatch({ type: "FILE_REMOVED", index: i })}
                      style={{
                        color: "var(--ink-tertiary)",
                        display: "inline-flex",
                      }}
                      aria-label="remove"
                    >
                      <Icon name="x" size={11} />
                    </button>
                  </span>
                ))}
              </div>
            )}

            {/* preloaded buttons */}
            <div style={{ display: "flex", gap: 12, marginTop: 16 }}>
              <ScenarioButton
                label="Clean Acme deal"
                dot="pass"
                disabled={mode === "running" || mode === "typing"}
                onClick={() => loadScenario("clean")}
              />
              <ScenarioButton
                label="BEC Acme deal"
                dot="block"
                disabled={mode === "running" || mode === "typing"}
                onClick={() => loadScenario("bec")}
              />
            </div>
          </div>

          {/* Run button */}
          <button
            onClick={runDiligence}
            disabled={mode !== "ready"}
            className="btn btn-primary"
            style={{
              flexShrink: 0,
              marginTop: 0,
              position: "relative",
              overflow: "hidden",
              ...(mode === "running"
                ? {
                    background: "var(--surface-2)",
                    color: "var(--ink-primary)",
                    fontFamily: "var(--font-mono)",
                  }
                : {}),
              opacity: mode !== "ready" && mode !== "running" ? 0.4 : 1,
            }}
          >
            {mode === "running" ? (
              <>
                <span>Running · {totalElapsed}s</span>
                <span
                  style={{
                    position: "absolute",
                    left: 0,
                    bottom: 0,
                    height: 2,
                    width: "60%",
                    background: "var(--status-live)",
                    animation: "indeterminate 1.4s ease-in-out infinite",
                  }}
                />
              </>
            ) : (
              <>
                <span>Run Diligence</span>
                <Icon name="arrow-right" size={14} />
              </>
            )}
          </button>
        </div>
      </div>

      {/* SIX-TILE GRID */}
      <div style={{ flex: 1, overflow: "auto", padding: "20px 32px 80px" }}>
        <div
          style={{
            display: "grid",
            gap: 12,
            gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
          }}
        >
          {DESK_ORDER.map((id, i) => (
            <div
              key={id}
              style={{
                animation: `fade-up 200ms ease-out ${i * 60}ms backwards`,
              }}
            >
              <DeskTile
                deskId={id}
                meta={DESK_META[id]}
                state={state.deskStates[id]}
                finding={state.findings[id]}
                progressMessage={state.progressMessages[id]}
                onClick={() => setDrawer(id)}
              />
            </div>
          ))}
        </div>
      </div>

      <VerdictBar
        mode={mode}
        verdict={state.verdict}
        resolvedCount={resolvedCount}
        totalElapsed={totalElapsed}
        go={go}
        onOpenBlockModal={() => setShowBlockModal(true)}
      />

      {drawer !== null && (
        <DeskDrawer
          deskId={drawer}
          meta={DESK_META[drawer]}
          state={state.deskStates[drawer]}
          finding={state.findings[drawer]}
          onClose={() => setDrawer(null)}
        />
      )}

      {showBlockModal && !showAmendPR && state.verdict && (
        <BlockModal
          verdict={state.verdict}
          findings={state.findings}
          onClose={() => setShowBlockModal(false)}
          onAmend={() => setShowAmendPR(true)}
        />
      )}
      {showAmendPR && state.verdict && state.runId && (
        <AmendmentPR
          override={buildOverrideContext(state.runId, state.verdict, state.findings)}
          nextId={nextAmendmentId}
          onCancel={() => setShowAmendPR(false)}
          onApprove={(a) => {
            onMergeAmendment(a);
            setShowAmendPR(false);
            setShowBlockModal(false);
            setToast(`amendment merged · MANDATE v ${a.id - 1}`);
            window.setTimeout(() => setToast(""), 1800);
          }}
        />
      )}
    </div>
  );
}

/* --------------------------------------------------------------- */
/* Helpers                                                         */
/* --------------------------------------------------------------- */

function buildOverrideContext(
  runId: string,
  verdict: NonNullable<ReturnType<typeof runReducer>["verdict"]>,
  findings: ReturnType<typeof runReducer>["findings"],
): OverrideContext {
  // Pull the clause from the blocking desk's mandate citation if present;
  // fall back to the verdict's blockingReason text.
  const blockingDesk = verdict.blockingDesk ?? "wire";
  const finding = findings[blockingDesk];
  const mandateCite = finding?.citations.find((c) => c.source === "mandate");
  return {
    runId,
    blockingDesk,
    blockingReason: verdict.blockingReason ?? verdict.summary,
    clause: mandateCite?.ref ?? "wire_safety §6.2",
  };
}

function ScenarioButton({
  label,
  dot,
  disabled,
  onClick,
}: {
  label: string;
  dot: "pass" | "block";
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 10,
        background: "var(--surface-1)",
        border: "1px solid var(--border-default)",
        borderRadius: 6,
        padding: "12px 16px",
        minHeight: 44,
        fontFamily: "var(--font-sans)",
        fontSize: 13,
        fontWeight: 500,
        color: "var(--ink-primary)",
        cursor: disabled ? "not-allowed" : "pointer",
        transition: "background 120ms ease",
        opacity: disabled ? 0.5 : 1,
      }}
      onMouseEnter={(e) => {
        if (!disabled) e.currentTarget.style.background = "var(--surface-2)";
      }}
      onMouseLeave={(e) => {
        if (!disabled) e.currentTarget.style.background = "var(--surface-1)";
      }}
    >
      <span className={`dot ${dot}`} />
      {label}
    </button>
  );
}
