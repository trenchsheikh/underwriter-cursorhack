"use client";

import { useState } from "react";
import { Icon } from "./Icon";
import { DeskTile } from "./DeskTile";
import { DeskDrawer } from "./DeskDrawer";
import { VerdictBar, type VerdictKind } from "./VerdictBar";
import { BlockModal } from "./BlockModal";
import { AmendmentPR } from "./AmendmentPR";
import { useElapsed } from "./useElapsed";
import {
  FILES_BEC,
  FILES_CLEAN,
  FIXTURES,
  PROMPT_TEXT,
} from "../state/fixtures";
import type {
  Amendment,
  DeskState,
  Route,
  RunState,
  Scenario,
} from "../state/types";

interface Props {
  runState: RunState;
  setRunState: React.Dispatch<React.SetStateAction<RunState>>;
  go: (r: Route) => void;
  setToast: (s: string) => void;
  /** Next available PR id (used by the "Override and amend" flow). */
  nextAmendmentId: number;
  /** Pushes a fresh amendment onto the global log. */
  onMergeAmendment: (a: Amendment) => void;
}

/** Compress timings 4× so the demo lands in ~7.5s instead of 30s. */
const SCALE = 0.25;

export function RunScreen({
  runState,
  setRunState,
  go,
  setToast,
  nextAmendmentId,
  onMergeAmendment,
}: Props) {
  const { mode, scenario, deskStates, citesShown, prompt, files } = runState;
  const [drawer, setDrawer] = useState<number | null>(null);
  const [showBlockModal, setShowBlockModal] = useState(false);
  const [showAmendPR, setShowAmendPR] = useState(false);

  const fixture = scenario ? FIXTURES[scenario] : FIXTURES.clean;
  const totalElapsed = useElapsed(mode === "running");
  const resolvedCount = deskStates.filter(
    (d) => d !== "streaming" && d !== "idle",
  ).length;

  // ===== Load a scenario: typewriter prompt + staggered file pills =====
  const loadScenario = (sc: Scenario) => {
    if (mode === "typing" || mode === "running") return;

    setRunState((s) => ({
      ...s,
      mode: "typing",
      scenario: sc,
      prompt: "",
      files: [],
      deskStates: Array(6).fill("idle") as DeskState[],
      citesShown: Array(6).fill(0),
    }));

    const target = PROMPT_TEXT;
    let i = 0;
    const tick = () => {
      i++;
      setRunState((s) => ({ ...s, prompt: target.slice(0, i) }));
      if (i < target.length) {
        setTimeout(tick, 12);
      } else {
        const targetFiles = sc === "clean" ? FILES_CLEAN : FILES_BEC;
        targetFiles.forEach((f, idx) => {
          setTimeout(() => {
            setRunState((s) => ({
              ...s,
              files: [...s.files, f],
              ...(idx === targetFiles.length - 1 ? { mode: "ready" } : {}),
            }));
          }, 120 + idx * 80);
        });
      }
    };
    setTimeout(tick, 80);
  };

  // ===== Run six desks in parallel with staggered citations =====
  const runDiligence = () => {
    if (mode !== "ready") return;
    setRunState((s) => ({
      ...s,
      mode: "running",
      runStart: Date.now(),
      deskStates: Array(6).fill("streaming") as DeskState[],
      citesShown: Array(6).fill(0),
    }));

    const desks = fixture.desks;

    desks.forEach((desk, i) => {
      const totalCites = desk.cites.length;
      const resolveAt = desk.delay * SCALE;
      const citeStart = 800;
      const citeGap =
        (resolveAt - citeStart - 400) / Math.max(totalCites, 1);

      desk.cites.forEach((_, ci) => {
        setTimeout(() => {
          setRunState((s) => {
            const cs = [...s.citesShown];
            cs[i] = ci + 1;
            return { ...s, citesShown: cs };
          });
        }, citeStart + ci * Math.max(citeGap, 200));
      });

      setTimeout(() => {
        setRunState((s) => {
          const ds = [...s.deskStates];
          ds[i] = desk.status;
          const cs = [...s.citesShown];
          cs[i] = totalCites;

          const allResolved = ds.every(
            (d) => d === "pass" || d === "flag" || d === "block",
          );
          if (allResolved) {
            // schedule transition to "resolved" and BEC modal pop
            setTimeout(
              () => setRunState((ss) => ({ ...ss, mode: "resolved" })),
              200,
            );
            if (scenario === "bec") {
              setTimeout(() => setShowBlockModal(true), 600);
            }
          }
          return { ...s, deskStates: ds, citesShown: cs };
        });
      }, resolveAt);
    });
  };

  // ===== Verdict for the bottom bar =====
  const verdict: VerdictKind =
    mode === "idle" || mode === "typing" || mode === "ready"
      ? "pre"
      : mode === "running"
      ? "running"
      : deskStates.includes("block")
      ? "block"
      : "pass";

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
            cursor: "pointer",
            padding: 0,
            background: "none",
            border: "none",
            fontSize: 11,
          }}
          onClick={() => {
            navigator.clipboard?.writeText("8a3f29c1");
            setToast("copied · 8a3f29c1");
            setTimeout(() => setToast(""), 1400);
          }}
          title="copy run id"
        >
          8a3f29c1
        </button>
        <span>·</span>
        <span>2026-04-30T16:42:18Z</span>
        <span>·</span>
        <span>MANDATE v 12</span>
        <span>·</span>
        <span>acme-ventures-iii</span>
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
                setRunState((s) => ({ ...s, prompt: e.target.value }))
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
                    key={i}
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
                      · {f.size}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setRunState((s) => ({
                          ...s,
                          files: s.files.filter((_, idx) => idx !== i),
                        }))
                      }
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
          {fixture.desks.map((desk, i) => (
            <div
              key={i}
              style={{
                animation: `fade-up 200ms ease-out ${i * 60}ms backwards`,
              }}
            >
              <DeskTile
                desk={desk}
                state={deskStates[i]}
                citesShown={deskStates[i] === "idle" ? 0 : citesShown[i]}
                onClick={() => setDrawer(i)}
              />
            </div>
          ))}
        </div>
      </div>

      <VerdictBar
        kind={verdict}
        resolvedCount={resolvedCount}
        totalElapsed={totalElapsed}
        go={go}
        setShowBlockModal={setShowBlockModal}
      />

      {drawer !== null && (
        <DeskDrawer
          desk={fixture.desks[drawer]}
          state={deskStates[drawer]}
          onClose={() => setDrawer(null)}
        />
      )}

      {showBlockModal && !showAmendPR && (
        <BlockModal
          onClose={() => setShowBlockModal(false)}
          onAmend={() => setShowAmendPR(true)}
        />
      )}
      {showAmendPR && (
        <AmendmentPR
          nextId={nextAmendmentId}
          onCancel={() => setShowAmendPR(false)}
          onApprove={(a) => {
            onMergeAmendment(a);
            setShowAmendPR(false);
            setShowBlockModal(false);
            setToast(`amendment merged · MANDATE v ${a.id - 1}`);
            setTimeout(() => setToast(""), 1800);
          }}
        />
      )}
    </div>
  );
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
