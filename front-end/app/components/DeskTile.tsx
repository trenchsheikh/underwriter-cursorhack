"use client";

import { useEffect, useState } from "react";
import { Icon } from "./Icon";
import { useElapsed } from "./useElapsed";
import type { Desk, DeskState } from "../state/types";

interface Props {
  desk: Desk;
  state: DeskState;
  citesShown: number;
  onClick: () => void;
}

export function DeskTile({ desk, state, citesShown, onClick }: Props) {
  const [flashed, setFlashed] = useState(false);
  useEffect(() => {
    if (state === "pass" || state === "flag" || state === "block") {
      setFlashed(true);
      const t = setTimeout(() => setFlashed(false), 280);
      return () => clearTimeout(t);
    }
  }, [state]);

  const isResolved = state === "pass" || state === "flag" || state === "block";
  const isBlock = state === "block";
  const elapsed = useElapsed(state === "streaming");

  const footerStatus =
    state === "idle" ? (
      <span style={{ color: "var(--ink-quaternary)" }}>— ready —</span>
    ) : state === "streaming" ? (
      <span
        style={{
          color: "var(--ink-secondary)",
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
        }}
      >
        <span className="dot live pulse" />
        <span>searching · {elapsed}s</span>
      </span>
    ) : state === "pass" ? (
      <span
        style={{
          color: "var(--status-pass)",
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
        }}
      >
        <Icon name="check" size={12} /> PASS
      </span>
    ) : state === "flag" ? (
      <span
        style={{
          color: "var(--status-flag)",
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
        }}
      >
        ⚠ FLAG
      </span>
    ) : (
      <span
        style={{
          color: "var(--status-block)",
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
        }}
      >
        <Icon name="x" size={12} /> BLOCK
      </span>
    );

  const flashAnim = flashed
    ? `border-flash-${state} 280ms ease-out forwards`
    : "none";

  return (
    <button
      onClick={onClick}
      style={{
        background: isBlock ? "var(--surface-2)" : "var(--surface-1)",
        border: `1px solid ${isBlock ? "var(--status-block)" : "var(--border-default)"}`,
        borderRadius: 6,
        textAlign: "left",
        cursor: "pointer",
        animation: flashAnim,
        display: "flex",
        flexDirection: "column",
        minHeight: 240,
        position: "relative",
        padding: 0,
        transition: "background 180ms ease",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "10px 16px",
          borderBottom: "1px solid var(--border-subtle)",
          position: "relative",
        }}
      >
        <span
          className="mono"
          style={{ fontSize: 11, color: "var(--ink-tertiary)" }}
        >
          [{desk.n}]
        </span>
        <span
          style={{
            fontSize: 13,
            fontWeight: 500,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            color: "var(--ink-primary)",
            flex: 1,
          }}
        >
          {desk.name}
        </span>
        <span style={{ color: "var(--ink-tertiary)", display: "inline-flex" }}>
          <Icon name={desk.icon} size={16} />
        </span>

        {state === "streaming" && (
          <div
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              bottom: -1,
              height: 2,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                width: "60%",
                height: 2,
                background: "var(--status-live)",
                animation: "indeterminate 1.4s ease-in-out infinite",
              }}
            />
          </div>
        )}
      </div>

      {/* Body */}
      <div
        style={{
          padding: 16,
          flex: 1,
          opacity:
            state === "idle" ? 0.3 : state === "streaming" ? 0.7 : 1,
          transition: "opacity 200ms ease",
        }}
      >
        <div
          style={{
            fontSize: 14,
            fontWeight: 500,
            color: "var(--ink-primary)",
            marginBottom: 4,
            lineHeight: "20px",
            textWrap: "pretty",
          }}
        >
          {desk.primary}
        </div>
        <div
          style={{
            fontSize: 12,
            color: "var(--ink-secondary)",
            marginBottom: 12,
            lineHeight: "18px",
            textWrap: "pretty",
          }}
        >
          {desk.facts}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {desk.cites.slice(0, citesShown).map((c, i) => (
            <div
              key={i}
              className={`cite-row ${c.src} fade-up`}
            >
              <span>{c.text}</span>
              {c.link && (
                <Icon name="external-link" size={11} className="ext-link" />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div
        style={{
          borderTop: "1px solid var(--border-subtle)",
          padding: "8px 16px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          fontFamily: "var(--font-mono)",
          fontSize: 11,
        }}
      >
        <span style={{ color: "var(--ink-tertiary)" }}>
          {isResolved ? `conf ${desk.conf} · ${desk.dur}` : ""}
        </span>
        {footerStatus}
      </div>
    </button>
  );
}
