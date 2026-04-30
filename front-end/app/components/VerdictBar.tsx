"use client";

import type { ReactNode } from "react";
import { Icon } from "./Icon";
import type { Route } from "../state/types";

export type VerdictKind = "pre" | "running" | "pass" | "block";

interface Props {
  kind: VerdictKind;
  resolvedCount: number;
  totalElapsed: string;
  go: (r: Route) => void;
  setShowBlockModal: (b: boolean) => void;
}

export function VerdictBar({
  kind,
  resolvedCount,
  totalElapsed,
  go,
  setShowBlockModal,
}: Props) {
  let bg = "var(--surface-1)";
  let topBar: ReactNode = null;
  let left: ReactNode = null;
  let cta: ReactNode = null;

  if (kind === "pre") {
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
  } else if (kind === "running") {
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
  } else if (kind === "pass") {
    bg = "linear-gradient(to top, rgba(91,206,145,0.04), var(--surface-1))";
    left = (
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 10,
          fontSize: 14,
          color: "var(--ink-primary)",
        }}
      >
        <span style={{ color: "var(--status-pass)", display: "inline-flex" }}>
          <Icon name="check" size={16} />
        </span>
        <span>
          <span style={{ color: "var(--status-pass)", fontWeight: 500 }}>
            PROCEED
          </span>{" "}
          — 6 of 6 desks pass · confidence 0.91
        </span>
      </span>
    );
    cta = (
      <button className="btn btn-primary" onClick={() => go("memo")}>
        Generate IC Memo <Icon name="arrow-right" size={14} />
      </button>
    );
  } else {
    bg = "linear-gradient(to top, rgba(229,72,77,0.05), var(--surface-1))";
    left = (
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 10,
          fontSize: 14,
          color: "var(--ink-primary)",
        }}
      >
        <span style={{ color: "var(--status-block)", display: "inline-flex" }}>
          <Icon name="x" size={16} />
        </span>
        <span>
          <span style={{ color: "var(--status-block)", fontWeight: 500 }}>
            HOLD
          </span>{" "}
          — Wire safety BLOCK at desk 06 · confidence 0.99
        </span>
      </span>
    );
    cta = (
      <div style={{ display: "flex", gap: 8 }}>
        <button
          className="btn btn-secondary"
          onClick={() => setShowBlockModal(true)}
        >
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
