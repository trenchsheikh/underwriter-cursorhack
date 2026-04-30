"use client";

import { Icon } from "./Icon";

interface Props {
  onClose: () => void;
  onAmend: () => void;
}

const ROWS: [string, string][] = [
  ["Source domain", "founder@acrne.co"],
  ["Verified domain", "founder@acme.co"],
  ["Edit distance", "1"],
  ["acrne.co WHOIS", "registered 2026-04-24"],
  ["DKIM", "FAIL"],
  ["Mandate clause", "wire_safety §6.2"],
];

export function BlockModal({ onClose, onAmend }: Props) {
  return (
    <>
      <div
        onClick={onClose}
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
          width: 560,
          maxHeight: "80vh",
          overflowY: "auto",
          background: "var(--surface-2)",
          border: "1px solid var(--status-block)",
          borderRadius: 6,
          padding: 32,
          zIndex: 61,
          boxShadow: "0 32px 80px rgba(0,0,0,0.6)",
        }}
      >
        <button
          onClick={onClose}
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
            display: "inline-flex",
            alignItems: "center",
            gap: 10,
            marginBottom: 16,
            color: "var(--status-block)",
            fontSize: 14,
            fontWeight: 500,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
          }}
        >
          <Icon name="alert-triangle" size={16} />
          Business Email Compromise pattern detected
        </div>

        <p
          style={{
            fontSize: 14,
            lineHeight: "22px",
            color: "var(--ink-primary)",
            marginBottom: 24,
            maxWidth: "60ch",
            textWrap: "pretty",
          }}
        >
          Wire instructions originated from a domain that resembles the
          verified company domain but is six days old and fails DKIM. Pattern
          is consistent with known BEC fraud.
        </p>

        <div
          style={{
            height: 1,
            background: "var(--border-subtle)",
            margin: "20px 0",
          }}
        />

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 4,
            marginBottom: 24,
          }}
        >
          {ROWS.map(([k, v], i) => (
            <div
              key={i}
              className="cite-row block"
              style={{
                display: "grid",
                gridTemplateColumns: "180px 1fr",
                gap: 16,
              }}
            >
              <span style={{ color: "var(--ink-tertiary)" }}>{k}</span>
              <span style={{ color: "var(--ink-primary)" }}>{v}</span>
            </div>
          ))}
        </div>

        <div
          style={{
            height: 1,
            background: "var(--border-subtle)",
            margin: "20px 0",
          }}
        />

        <div
          style={{
            marginBottom: 24,
            fontSize: 14,
            lineHeight: "22px",
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "180px 1fr",
              gap: 16,
              marginBottom: 8,
            }}
          >
            <span style={{ color: "var(--ink-tertiary)" }}>
              Recommended action
            </span>
            <span style={{ color: "var(--ink-primary)", fontWeight: 500 }}>
              HOLD
            </span>
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "180px 1fr",
              gap: 16,
            }}
          >
            <span style={{ color: "var(--ink-tertiary)" }}>Required</span>
            <span style={{ color: "var(--ink-primary)" }}>
              phone confirmation to number on file from SPA (§6.4)
            </span>
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button className="btn btn-secondary" onClick={onClose}>
            Hold wire
          </button>
          <button className="btn btn-secondary" onClick={onAmend}>
            Override and amend
          </button>
        </div>
      </div>
    </>
  );
}
