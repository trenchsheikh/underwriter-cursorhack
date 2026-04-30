"use client";

import type { ReactNode } from "react";
import { Icon } from "./Icon";
import type { Verdict } from "../lib/contract";
import type { Route } from "../state/types";
import type { Mode } from "../lib/runReducer";
import { formatConfidence } from "../lib/format";

interface Props {
  mode: Mode;
  verdict: Verdict | null;
  resolvedCount: number;
  totalElapsed: string;
  go: (r: Route) => void;
  onOpenBlockModal: () => void;
}

export function VerdictBar({
  mode,
  verdict,
  resolvedCount,
  totalElapsed,
  go,
  onOpenBlockModal,
}: Props) {
  let bg = "var(--surface-1)";
  let topBar: ReactNode = null;
  let left: ReactNode = null;
  let cta: ReactNode = null;

  if (mode === "idle" || mode === "typing" || mode === "ready") {
    left = (
      <span
        style={{
          color: "var(--ink-tertiary)",
          fontFamily: "var(--font-mono)",
          fontSize: 12,
        }}
      >
        — awaiting input —
      </span>
    );
  } else if (mode === "running" && !verdict) {
    left = (
      <span
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 12,
          color: "var(--ink-secondary)",
        }}
      >
        {resolvedCount} of 6 desks resolved · {totalElapsed}s
      </span>
    );
    topBar = (
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          height: 2,
          width: `${(resolvedCount / 6) * 100}%`,
          background: "var(--status-live)",
          transition: "width 240ms ease",
        }}
      />
    );
  } else if (verdict?.action === "proceed") {
    bg = "linear-gradient(to top, rgba(91,206,145,0.04), var(--surface-1))";
    left = (
      <VerdictLeft
        color="var(--status-pass)"
        icon="check"
        label="PROCEED"
        summary={verdict.summary}
        confidence={verdict.confidence}
      />
    );
    cta = (
      <button className="btn btn-primary" onClick={() => go("memo")}>
        Generate IC Memo <Icon name="arrow-right" size={14} />
      </button>
    );
  } else if (verdict?.action === "review") {
    bg = "linear-gradient(to top, rgba(229,179,65,0.05), var(--surface-1))";
    left = (
      <VerdictLeft
        color="var(--status-flag)"
        icon="alert-triangle"
        label="REVIEW"
        summary={verdict.summary}
        confidence={verdict.confidence}
      />
    );
    cta = (
      <button className="btn btn-primary" onClick={() => go("memo")}>
        Generate IC Memo <Icon name="arrow-right" size={14} />
      </button>
    );
  } else if (verdict?.action === "hold") {
    bg = "linear-gradient(to top, rgba(229,72,77,0.05), var(--surface-1))";
    left = (
      <VerdictLeft
        color="var(--status-block)"
        icon="x"
        label="HOLD"
        summary={verdict.summary}
        confidence={verdict.confidence}
      />
    );
    cta = (
      <div style={{ display: "flex", gap: 8 }}>
        <button className="btn btn-secondary" onClick={onOpenBlockModal}>
          Open BEC report <Icon name="arrow-right" size={14} />
        </button>
        <button className="btn btn-primary" onClick={() => go("memo")}>
          Generate IC Memo <Icon name="arrow-right" size={14} />
        </button>
      </div>
    );
  }

  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 0,
        height: 64,
        background: bg,
        borderTop: "1px solid var(--border-subtle)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 32px",
        zIndex: 10,
      }}
    >
      {topBar}
      {left}
      {cta}
    </div>
  );
}

function VerdictLeft({
  color,
  icon,
  label,
  summary,
  confidence,
}: {
  color: string;
  icon: "check" | "x" | "alert-triangle";
  label: string;
  summary: string;
  confidence: number;
}) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 10,
        fontSize: 14,
        color: "var(--ink-primary)",
      }}
    >
      <span style={{ color, display: "inline-flex" }}>
        <Icon name={icon} size={16} />
      </span>
      <span>
        <span style={{ color, fontWeight: 500 }}>{label}</span>
        {" — "}
        {summary} · confidence {formatConfidence(confidence)}
      </span>
    </span>
  );
}
