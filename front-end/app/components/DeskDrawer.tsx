"use client";

import { useState } from "react";
import { Icon } from "./Icon";
import type { Desk, DeskState } from "../state/types";

interface Props {
  desk: Desk;
  state: DeskState;
  onClose: () => void;
}

export function DeskDrawer({ desk, onClose }: Props) {
  const [showRaw, setShowRaw] = useState(false);
  return (
    <>
      <div
        onClick={onClose}
        className="fade-in"
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.4)",
          zIndex: 50,
        }}
      />
      <aside
        style={{
          position: "fixed",
          top: 0,
          right: 0,
          bottom: 0,
          width: 480,
          background: "var(--surface-2)",
          borderLeft: "1px solid var(--border-default)",
          zIndex: 51,
          padding: 24,
          overflowY: "auto",
          animation: "slide-in 200ms ease",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 24,
          }}
        >
          <span
            className="mono"
            style={{ fontSize: 11, color: "var(--ink-tertiary)" }}
          >
            [{desk.n}] {desk.name.toUpperCase()}
          </span>
          <button
            onClick={onClose}
            style={{ color: "var(--ink-secondary)", display: "inline-flex" }}
          >
            <Icon name="x" size={16} />
          </button>
        </div>

        <div
          style={{
            fontSize: 18,
            color: "var(--ink-primary)",
            marginBottom: 8,
            lineHeight: "24px",
          }}
        >
          {desk.primary}
        </div>
        <div
          style={{
            fontSize: 14,
            color: "var(--ink-secondary)",
            marginBottom: 24,
            lineHeight: "22px",
            textWrap: "pretty",
          }}
        >
          {desk.facts}
        </div>

        <div className="section-heading" style={{ marginBottom: 12 }}>
          Citations
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 4,
            marginBottom: 24,
          }}
        >
          {desk.cites.map((c, i) => (
            <div key={i} className={`cite-row ${c.src}`}>
              <span>{c.text}</span>
              <Icon name="external-link" size={11} className="ext-link" />
            </div>
          ))}
        </div>

        <div className="section-heading" style={{ marginBottom: 12 }}>
          Timeline
        </div>
        <div
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            color: "var(--ink-secondary)",
            display: "flex",
            flexDirection: "column",
            gap: 6,
            marginBottom: 24,
          }}
        >
          <div>00.00s · desk dispatched</div>
          {desk.cites.map((c, i) => (
            <div key={i}>
              {(0.6 + i * 0.9).toFixed(2)}s · citation arrived · {c.src}
            </div>
          ))}
          <div>
            {desk.dur} · resolved · {desk.status.toUpperCase()}
          </div>
        </div>

        <button
          onClick={() => setShowRaw((s) => !s)}
          className="btn-ghost mono"
          style={{ fontSize: 11, padding: "4px 0", marginBottom: 8 }}
        >
          {showRaw ? "▾ hide raw response" : "▸ show raw response"}
        </button>
        {showRaw && (
          <pre
            style={{
              background: "var(--surface-3)",
              border: "1px solid var(--border-default)",
              borderRadius: 4,
              padding: 12,
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              color: "var(--ink-secondary)",
              overflow: "auto",
              whiteSpace: "pre-wrap",
            }}
          >
            {JSON.stringify(
              {
                desk: desk.n,
                name: desk.name,
                status: desk.status,
                confidence: parseFloat(desk.conf),
                duration_s: parseFloat(desk.dur),
                primary: desk.primary,
                facts: desk.facts,
                citations: desk.cites,
              },
              null,
              2,
            )}
          </pre>
        )}
      </aside>
    </>
  );
}
