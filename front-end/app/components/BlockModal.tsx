"use client";

import { Icon } from "./Icon";
import type { DeskFinding, DeskId, Verdict } from "../lib/contract";
import { citeText } from "../lib/format";

interface Props {
  verdict: Verdict;
  findings: Record<DeskId, DeskFinding | null>;
  onClose: () => void;
  onAmend: () => void;
}

export function BlockModal({ verdict, findings, onClose, onAmend }: Props) {
  const blockingDesk = verdict.blockingDesk ?? "wire";
  const finding = findings[blockingDesk];
  // Render the rows from the actual finding's citations + facts where
  // possible, so the modal reflects the real run rather than a hardcoded
  // BEC fixture. Fall back to the static rows for the demo if the
  // finding hasn't shipped enough detail.
  const rows = buildRows(finding);

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
          {finding?.primary ?? "Wire safety block"}
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
          {verdict.blockingReason ?? verdict.summary}
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
          {rows.map(([k, v], i) => (
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

/**
 * Surface the most useful evidence we have. Prefer:
 *   1. Citations on the blocking finding (real evidence from the desk).
 *   2. Facts as fallback.
 *   3. The static BEC pattern rows when neither is present (demo
 *      compatibility).
 */
function buildRows(finding: DeskFinding | null): [string, string][] {
  if (!finding) return STATIC_BEC_ROWS;

  if (finding.citations.length > 0) {
    return finding.citations.slice(0, 6).map((c) => {
      const label =
        c.source === "mandate"   ? "Mandate clause"
      : c.source === "whois"     ? "WHOIS"
      : c.source === "opensanctions" ? "Sanctions"
      : c.source === "companies-house" ? "Registry"
      : c.source === "spa"       ? "SPA"
      : c.source === "linkedin"  ? "LinkedIn"
      :                            "Source";
      return [label, citeText(c)];
    });
  }
  if (finding.facts.length > 0) {
    return finding.facts.map((f, i) => [`Detail ${i + 1}`, f]);
  }
  return STATIC_BEC_ROWS;
}

const STATIC_BEC_ROWS: [string, string][] = [
  ["Source domain", "founder@acrne.co"],
  ["Verified domain", "founder@acme.co"],
  ["Edit distance", "1"],
  ["acrne.co WHOIS", "registered 2026-04-24"],
  ["DKIM", "FAIL"],
  ["Mandate clause", "wire_safety §6.2"],
];
