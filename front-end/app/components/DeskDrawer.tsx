"use client";

import { useState } from "react";
import { Icon } from "./Icon";
import type { DeskFinding, DeskId, Status } from "../lib/contract";
import type { DeskMeta } from "../lib/deskMeta";
import { citeCssClass } from "../lib/citeColor";
import { citeText, formatDuration, formatConfidence } from "../lib/format";

interface Props {
  deskId: DeskId;
  meta: DeskMeta;
  state: Status;
  finding: DeskFinding | null;
  onClose: () => void;
}

export function DeskDrawer({ deskId: _deskId, meta, state, finding, onClose }: Props) {
  const [showRaw, setShowRaw] = useState(false);
  const citations = finding?.citations ?? [];
  const facts = finding?.facts ?? [];

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
            [{meta.number}] {meta.title.toUpperCase()}
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
          {finding?.primary ?? (state === "streaming" ? "…" : "—")}
        </div>
        {facts.length > 0 && (
          <div
            style={{
              fontSize: 14,
              color: "var(--ink-secondary)",
              marginBottom: 24,
              lineHeight: "22px",
              textWrap: "pretty",
            }}
          >
            {facts.join(" · ")}
          </div>
        )}

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
          {citations.map((c, i) => (
            <div key={i} className={`cite-row ${citeCssClass(c.source)}`}>
              <span>{citeText(c)}</span>
              {c.url && (
                <a
                  href={c.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ext-link"
                  style={{ display: "inline-flex" }}
                >
                  <Icon name="external-link" size={11} />
                </a>
              )}
              {c.cached && (
                <span
                  className="mono"
                  style={{
                    fontSize: 9,
                    color: "var(--ink-tertiary)",
                    marginLeft: "auto",
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                  }}
                >
                  cached
                </span>
              )}
            </div>
          ))}
        </div>

        {finding && (
          <>
            <div className="section-heading" style={{ marginBottom: 12 }}>
              Outcome
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
              <div>status · {finding.status.toUpperCase()}</div>
              <div>confidence · {formatConfidence(finding.confidence)}</div>
              <div>duration · {formatDuration(finding.durationMs)}</div>
            </div>
          </>
        )}

        <button
          onClick={() => setShowRaw((s) => !s)}
          className="btn-ghost mono"
          style={{ fontSize: 11, padding: "4px 0", marginBottom: 8 }}
        >
          {showRaw ? "▾ hide raw response" : "▸ show raw response"}
        </button>
        {showRaw && finding && (
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
            {JSON.stringify(finding.raw ?? finding, null, 2)}
          </pre>
        )}
      </aside>
    </>
  );
}
