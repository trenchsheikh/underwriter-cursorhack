"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { Icon } from "./Icon";
import type { DeskFinding, MemoData } from "../lib/contract";
import type { Route } from "../state/types";
import { getMemo } from "../lib/memo";
import { DESK_META, DESK_ORDER } from "../lib/deskMeta";

interface Props {
  runId: string | null;
  go: (r: Route) => void;
}

const memoH2: CSSProperties = {
  fontFamily: "var(--font-sans)",
  fontSize: 14,
  fontWeight: 500,
  textTransform: "uppercase",
  letterSpacing: "0.12em",
  color: "var(--paper-muted)",
  marginBottom: 12,
};

type Stage =
  | { kind: "idle" }                       // no runId yet
  | { kind: "loading" }
  | { kind: "loaded"; memo: MemoData }
  | { kind: "error"; message: string };

export function MemoScreen({ runId, go }: Props) {
  const [stage, setStage] = useState<Stage>(
    runId ? { kind: "loading" } : { kind: "idle" },
  );

  useEffect(() => {
    if (!runId) {
      setStage({ kind: "idle" });
      return;
    }
    setStage({ kind: "loading" });
    const ac = new AbortController();
    getMemo(runId, ac.signal)
      .then((memo) => setStage({ kind: "loaded", memo }))
      .catch((err: Error) => {
        if (ac.signal.aborted) return;
        setStage({ kind: "error", message: err.message });
      });
    return () => ac.abort();
  }, [runId]);

  if (stage.kind === "idle") {
    return (
      <MemoEmpty
        title="No run selected"
        body="Run a diligence on the Diligence screen to generate an IC memo."
        go={go}
      />
    );
  }
  if (stage.kind === "loading") {
    return <MemoLoading />;
  }
  if (stage.kind === "error") {
    return (
      <MemoEmpty
        title="Memo unavailable"
        body={stage.message}
        go={go}
      />
    );
  }

  return <MemoBody memo={stage.memo} go={go} />;
}

/* ---------------------- shells ---------------------- */

function MemoEmpty({
  title,
  body,
  go,
}: {
  title: string;
  body: string;
  go: (r: Route) => void;
}) {
  return (
    <div
      style={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 12,
        padding: 32,
        background: "var(--paper)",
        color: "var(--paper-ink)",
      }}
    >
      <div
        style={{
          fontFamily: "var(--font-display)",
          fontStyle: "italic",
          fontSize: 28,
        }}
      >
        {title}
      </div>
      <div
        style={{
          color: "var(--paper-muted)",
          maxWidth: 480,
          textAlign: "center",
        }}
      >
        {body}
      </div>
      <button
        className="btn btn-secondary"
        onClick={() => go("run")}
        style={{ marginTop: 16 }}
      >
        Go to Diligence <Icon name="arrow-right" size={14} />
      </button>
    </div>
  );
}

function MemoLoading() {
  return (
    <div
      style={{
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--paper)",
        color: "var(--paper-muted)",
        fontFamily: "var(--font-mono)",
        fontSize: 13,
        gap: 10,
      }}
    >
      <span className="dot live pulse" />
      Loading memo
    </div>
  );
}

/* ---------------------- body ---------------------- */

function MemoBody({ memo, go }: { memo: MemoData; go: (r: Route) => void }) {
  const stamp = stampFor(memo.verdict.action);

  // Compliance table: derive per-desk row from findings.
  const findingByDesk: Record<string, DeskFinding | undefined> = {};
  for (const f of memo.findings) findingByDesk[f.desk] = f;
  const complianceRows = DESK_ORDER.map((id) => {
    const f = findingByDesk[id];
    const label = DESK_META[id].title;
    const status = f?.status ?? "—";
    return [label, status.toUpperCase()] as const;
  });

  return (
    <div style={{ height: "100vh", overflow: "auto", background: "var(--paper)" }}>
      {/* Toolbar (hidden in print) */}
      <div
        className="memo-toolbar"
        style={{
          position: "sticky",
          top: 0,
          zIndex: 5,
          background: "var(--paper)",
          borderBottom: "1px solid rgba(26,23,21,0.1)",
          padding: "12px 32px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <button
          onClick={() => go("run")}
          className="mono"
          style={{
            fontSize: 11,
            color: "var(--paper-muted)",
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            textTransform: "uppercase",
            letterSpacing: "0.06em",
          }}
        >
          ← back to run
        </button>
        <button
          className="mono"
          onClick={() => window.print()}
          style={{
            fontSize: 12,
            color: "var(--paper-ink)",
            border: "1px solid var(--paper-rule)",
            borderRadius: 0,
            padding: "8px 14px",
            background: "transparent",
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          Download PDF <Icon name="arrow-right" size={12} />
        </button>
      </div>

      <article
        className="memo-page fade-in"
        style={{
          maxWidth: 640,
          margin: "0 auto",
          padding: "64px 48px 96px",
          color: "var(--paper-ink)",
          fontFamily: "var(--font-sans)",
          fontSize: 13,
          lineHeight: "22px",
        }}
      >
        {/* Top header strip */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            color: "var(--paper-ink)",
            textTransform: "uppercase",
            letterSpacing: "0.04em",
            paddingBottom: 12,
            borderBottom: "1px solid var(--paper-rule)",
            marginBottom: 32,
          }}
        >
          <div>
            <div>{memo.fund.name}</div>
            <div style={{ color: "var(--paper-muted)" }}>
              Investment Committee Memo
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div>Run {memo.runId}</div>
            <div style={{ color: "var(--paper-muted)" }}>
              {memo.generatedAt}
            </div>
          </div>
        </div>

        {/* Title + stamp */}
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 32,
            marginBottom: 48,
          }}
        >
          <div style={{ flex: 1 }}>
            <h1
              style={{
                fontFamily: "var(--font-display)",
                fontSize: 32,
                fontWeight: 400,
                lineHeight: "36px",
                color: "var(--paper-ink)",
                marginBottom: 8,
              }}
            >
              <span style={{ fontStyle: "italic" }}>{memo.deal.company}</span>
            </h1>
            <div
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 12,
                color: "var(--paper-muted)",
              }}
            >
              {memo.deal.round} · ${memo.deal.amountUsd.toLocaleString()}
              {memo.deal.proRataPct != null && ` · ${memo.deal.proRataPct}% pro-rata`}
            </div>
          </div>
          <div
            className="memo-stamp"
            style={{
              display: "inline-flex",
              padding: "8px 16px",
              border: `2px solid ${stamp.color}`,
              color: stamp.color,
              fontFamily: "var(--font-mono)",
              fontSize: 14,
              fontWeight: 500,
              textTransform: "uppercase",
              letterSpacing: "0.04em",
              transform: "rotate(-2deg)",
              whiteSpace: "nowrap",
              animation: "stamp-settle 360ms ease-out 240ms backwards",
            }}
          >
            {stamp.label}
          </div>
        </div>

        {/* Summary */}
        <h2 style={memoH2}>Summary</h2>
        <p
          style={{
            fontFamily: "var(--font-display)",
            fontStyle: "italic",
            fontSize: 18,
            lineHeight: "28px",
            color: "var(--paper-ink)",
            marginBottom: 40,
            textWrap: "pretty",
          }}
        >
          {memo.summary}
        </p>

        {/* Mandate compliance */}
        <h2 style={memoH2}>Mandate compliance</h2>
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            marginBottom: 40,
            fontFamily: "var(--font-sans)",
            fontSize: 13,
          }}
        >
          <tbody>
            {complianceRows.map(([rule, status], i) => (
              <tr
                key={i}
                style={{ borderBottom: "1px solid rgba(26,23,21,0.08)" }}
              >
                <td style={{ padding: "8px 0", color: "var(--paper-ink)" }}>
                  {rule}
                </td>
                <td
                  style={{
                    padding: "8px 0",
                    textAlign: "right",
                    fontFamily: "var(--font-mono)",
                    fontSize: 11,
                    color: complianceColor(status),
                  }}
                >
                  {status}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Findings */}
        <h2 style={memoH2}>Findings by desk</h2>
        {memo.findings.map((f, i) => (
          <div key={i} style={{ marginBottom: 24 }}>
            <div
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 11,
                color: "var(--paper-muted)",
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                marginBottom: 4,
              }}
            >
              {f.number} {DESK_META[f.desk].title}
            </div>
            <p
              style={{
                marginBottom: 6,
                color:
                  f.status === "block"
                    ? "var(--paper-stamp-block)"
                    : "var(--paper-ink)",
                textWrap: "pretty",
              }}
            >
              {f.primary}
              {f.facts.length > 0 && ` — ${f.facts.join(" · ")}`}
            </p>
            {f.citations.length > 0 && (
              <div
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 10,
                  color: "var(--paper-muted)",
                }}
              >
                {f.citations
                  .map((c) => `${c.source}: ${c.detail ?? c.ref}`)
                  .join(" · ")}
              </div>
            )}
          </div>
        ))}

        {/* Recommendation */}
        <h2 style={{ ...memoH2, marginTop: 40 }}>Recommendation</h2>
        <div
          style={{
            position: "relative",
            paddingLeft: 16,
            margin: "16px 0 40px",
          }}
        >
          <div
            style={{
              position: "absolute",
              left: 0,
              top: 4,
              bottom: 4,
              width: 2,
              background: stamp.color,
            }}
          />
          <p
            style={{
              fontFamily: "var(--font-display)",
              fontStyle: "italic",
              fontSize: 18,
              lineHeight: "26px",
              color: "var(--paper-ink)",
              textWrap: "pretty",
            }}
          >
            {memo.recommendation}
          </p>
        </div>

        {/* Required actions */}
        <h2 style={memoH2}>Required actions</h2>
        <ol style={{ paddingLeft: 20, marginBottom: 56 }}>
          {memo.requiredActions.map((a, i) => (
            <li
              key={i}
              style={{
                marginBottom: 8,
                color: "var(--paper-ink)",
                textWrap: "pretty",
              }}
            >
              {a}
            </li>
          ))}
        </ol>

        {/* Footer */}
        <div
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            color: "var(--paper-muted)",
            paddingTop: 24,
            borderTop: "1px solid var(--paper-rule)",
          }}
        >
          Generated by Mandate · Cursor SDK · Specter · {memo.generatedAt}
        </div>
      </article>
    </div>
  );
}

function stampFor(action: MemoData["verdict"]["action"]): {
  label: string;
  color: string;
} {
  switch (action) {
    case "proceed":
      return { label: "✓ PROCEED", color: "var(--paper-stamp-pass)" };
    case "review":
      return { label: "⚠ REVIEW", color: "var(--paper-stamp-flag)" };
    case "hold":
      return { label: "✕ HOLD", color: "var(--paper-stamp-block)" };
  }
}

function complianceColor(status: string): string {
  switch (status) {
    case "PASS":
      return "var(--paper-stamp-pass)";
    case "FLAG":
      return "var(--paper-stamp-flag)";
    case "BLOCK":
      return "var(--paper-stamp-block)";
    default:
      return "var(--paper-muted)";
  }
}
