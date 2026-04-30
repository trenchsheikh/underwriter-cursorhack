"use client";

import { Icon } from "./Icon";
import type { Amendment } from "../state/types";

interface Props {
  /** Called with the merged amendment so the App can push it onto state. */
  onApprove: (a: Amendment) => void;
  onCancel: () => void;
  /** ID to assign to the new amendment PR. */
  nextId: number;
}

const DIFF_LINES: { t: "meta" | "ctx" | "add" | "rm"; text: string }[] = [
  { t: "meta", text: "@@ wire_safety @@" },
  { t: "ctx",  text: "  wire_safety:" },
  { t: "ctx",  text: "    domain_age_min_days: 30" },
  { t: "ctx",  text: "    domain_edit_distance_block: 2" },
  { t: "add",  text: "+   blocked_domains_seen_in_attacks:" },
  { t: "add",  text: "+     - acrne.co  # added 2026-04-30 from 8a3f" },
  { t: "add",  text: "+   require_phone_confirmation_above_usd:" },
  { t: "add",  text: "+     1_000_000" },
];

const RAW_DIFF = DIFF_LINES.map((l) => l.text).filter((t) => !t.startsWith("@@"));

export function AmendmentPR({ onApprove, onCancel, nextId }: Props) {
  const merge = () => {
    const merged: Amendment = {
      id: nextId,
      date: new Date().toISOString().slice(0, 10),
      author: "Mandate · agent",
      summary:
        "Block lookalike domain acrne.co; require phone confirmation above $1M.",
      lines: "+4",
      diff: RAW_DIFF,
      active: true,
    };
    onApprove(merged);
  };

  return (
    <>
      <div
        onClick={onCancel}
        className="fade-in"
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.55)",
          zIndex: 60,
        }}
      />
      <div
        className="scale-in"
        style={{
          position: "fixed",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: 680,
          maxHeight: "85vh",
          overflowY: "auto",
          background: "var(--surface-2)",
          border: "1px solid var(--border-default)",
          borderRadius: 6,
          padding: 32,
          zIndex: 61,
          boxShadow: "0 32px 80px rgba(0,0,0,0.6)",
        }}
      >
        <button
          onClick={onCancel}
          style={{
            position: "absolute",
            top: 16,
            right: 16,
            color: "var(--ink-secondary)",
            display: "inline-flex",
          }}
        >
          <Icon name="x" size={16} />
        </button>

        <div
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            color: "var(--ink-secondary)",
            textTransform: "uppercase",
            letterSpacing: "0.06em",
            marginBottom: 6,
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <Icon name="git-pull-request" size={12} />
          AMENDMENT PR · #{nextId} · branch: amend/lookalike-domain
        </div>
        <div
          style={{
            height: 1,
            background: "var(--border-subtle)",
            margin: "16px 0",
          }}
        />

        <div className="section-heading" style={{ marginBottom: 8 }}>
          File changed
        </div>
        <div
          className="mono"
          style={{
            fontSize: 12,
            color: "var(--ink-primary)",
            marginBottom: 16,
          }}
        >
          MANDATE.md
        </div>

        <div
          style={{
            background: "var(--surface-0)",
            border: "1px solid var(--border-default)",
            borderRadius: 4,
            padding: 12,
            marginBottom: 24,
            fontFamily: "var(--font-mono)",
            fontSize: 12,
            lineHeight: "20px",
            overflowX: "auto",
          }}
        >
          {DIFF_LINES.map((l, i) => {
            const bg =
              l.t === "add"
                ? "rgba(91,206,145,0.07)"
                : l.t === "rm"
                ? "rgba(229,72,77,0.07)"
                : "transparent";
            const color =
              l.t === "add"
                ? "var(--status-pass)"
                : l.t === "rm"
                ? "var(--status-block)"
                : l.t === "meta"
                ? "var(--accent-vellum)"
                : "var(--ink-secondary)";
            return (
              <div
                key={i}
                style={{
                  background: bg,
                  color,
                  padding: "0 4px",
                  whiteSpace: "pre",
                  animation:
                    l.t === "add"
                      ? `fade-up 200ms ease-out ${i * 60}ms backwards`
                      : "none",
                }}
              >
                {l.text}
              </div>
            );
          })}
        </div>

        <div className="section-heading" style={{ marginBottom: 8 }}>
          Rationale (drafted by agent)
        </div>
        <div
          style={{
            fontFamily: "var(--font-display)",
            fontStyle: "italic",
            fontSize: 14,
            lineHeight: "22px",
            color: "var(--ink-primary)",
            paddingLeft: 16,
            marginBottom: 24,
            position: "relative",
            maxWidth: "60ch",
          }}
        >
          <div
            style={{
              position: "absolute",
              left: 0,
              top: 4,
              bottom: 4,
              width: 2,
              background: "var(--accent-vellum)",
            }}
          />
          &ldquo;Run 8a3f detected a 1-letter lookalike of acme.co (acrne.co,
          6 days old). Adding the specific domain to the blocklist and
          requiring phone confirmation for any wire above $1M to prevent
          recurrence.&rdquo;
        </div>

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button className="btn btn-secondary" onClick={onCancel}>
            Request changes
          </button>
          <button className="btn btn-primary" onClick={merge}>
            Approve & merge
          </button>
        </div>
      </div>
    </>
  );
}
