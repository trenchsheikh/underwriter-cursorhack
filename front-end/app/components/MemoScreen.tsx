"use client";

import type { CSSProperties } from "react";
import { Icon } from "./Icon";
import type { Route, RunState } from "../state/types";

interface Props {
  runState: RunState;
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

export function MemoScreen({ runState, go }: Props) {
  const isBlock =
    runState.scenario === "bec" && runState.deskStates.includes("block");

  const stamp = isBlock
    ? { label: "✕ HOLD", color: "var(--paper-stamp-block)" }
    : { label: "✓ PROCEED", color: "var(--paper-stamp-pass)" };

  const summary = isBlock
    ? "Acme Robotics Series A is within the fund's mandate and round terms are sound, but the wire instructions originated from a domain registered six days ago that resembles the verified company domain by a single character and fails DKIM. Recommendation: hold and confirm out-of-band before any wire is released."
    : "Acme Robotics Series A is within the fund's mandate, lead investor is verified active, round terms reconcile to the SPA, and wire instructions pass all integrity checks. Recommendation: proceed.";

  const recommendation = isBlock
    ? "Hold the wire. Phone-confirm the receiving account directly to the number on file from the SPA before any release."
    : "Proceed with the $2,000,000 wire to Acme Robotics Ltd, Series A, at the agreed pro-rata of 50% of allocation.";

  const requiredActions = isBlock
    ? [
        "Place wire on hold pending out-of-band confirmation.",
        "Contact founder via phone number from SPA §6.4 to verify receiving account.",
        "Merge amendment PR to add acrne.co to the blocklist and require phone confirmation above $1M.",
        "Re-run diligence with confirmed wire instructions before release.",
      ]
    : [
        "Counter-sign SPA per signing matrix (2 signers, tier 2).",
        "Release wire of $2,000,000 to verified acme.co receiving account.",
        'Record close in portfolio register; tag company "acme-robotics" cohort 2026-Q2.',
        "Schedule first board observer meeting within 30 days.",
      ];

  const rules: [string, "PASS" | "FAIL"][] = [
    ["Sector permitted (robotics)", "PASS"],
    ["Geography permitted (UK)", "PASS"],
    ["Cheque size within tier 2 ($500K–$5M)", "PASS"],
    ["Pro-rata reserves consistent", "PASS"],
    ["Founder background verified", "PASS"],
    ["Lead investor confirmed", "PASS"],
    ["Wire integrity", isBlock ? "FAIL" : "PASS"],
    ["Sanctions screen", "PASS"],
  ];

  const findings = [
    {
      n: "§1",
      name: "Company",
      text: "Acme Robotics Ltd, incorporated 2021 in Cambridge, UK. 47 FTE. Active filings current to 2026-Q1.",
      cite: "Specter ABC-92 · Companies House 13427891",
    },
    {
      n: "§2",
      name: "Founder",
      text: "Sarah Chen, CEO and co-founder, ex-Boston Dynamics and DeepMind robotics. One prior exit (Cobalt Robotics → ABB, 2019).",
      cite: "Specter People P-441829 · LinkedIn verified",
    },
    {
      n: "§3",
      name: "Lead investor",
      text: "Sequoia Capital. Four partner-level engagement signals in the last 60 days; pattern consistent with lead in EU robotics sector.",
      cite: "Specter Interest Signals · 11 comparable lead rounds",
    },
    {
      n: "§4",
      name: "Round dynamics",
      text: "Series A at $18M on $80M post-money. Within EU robotics 2025 medians ($16M @ $74M). Pro-rata reconciles: $2M = 50% of $4M allocation.",
      cite: "Specter Transactions n=23 · SPA §3.1",
    },
    {
      n: "§5",
      name: "Mandate",
      text: "8 of 8 rules pass. Within signing matrix tier 2 (two signers). Sector and geography permitted under v12 of the mandate.",
      cite: "MANDATE.md v12 · clauses 2,3,4,5",
    },
    isBlock
      ? {
          n: "§6",
          name: "Wire safety",
          text: "BLOCK. Wire instructions originated from acrne.co, registered 2026-04-24 (six days old), edit distance 1 from verified domain acme.co. DKIM fails. Pattern consistent with BEC.",
          cite: "WHOIS 2026-04-24 · wire_safety §6.2",
          block: true,
        }
      : {
          n: "§6",
          name: "Wire safety",
          text: "Domain acme.co, age 1,847 days. DKIM, SPF and beneficial-owner match all clear. No sanctions or PEP hits across four lists.",
          cite: "WHOIS 2021-01-15 · OpenSanctions clear",
        },
  ];

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
            <div>Acme Ventures III</div>
            <div style={{ color: "var(--paper-muted)" }}>
              Investment Committee Memo
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div>Run 8a3f29c1</div>
            <div style={{ color: "var(--paper-muted)" }}>
              2026-04-30 16:42 UTC
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
              <span style={{ fontStyle: "italic" }}>Acme Robotics Ltd</span>
            </h1>
            <div
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 12,
                color: "var(--paper-muted)",
              }}
            >
              Series A · $2,000,000 · 50% pro-rata
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
          {summary}
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
            {rules.map(([rule, status], i) => (
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
                    color:
                      status === "PASS"
                        ? "var(--paper-stamp-pass)"
                        : "var(--paper-stamp-block)",
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
        {findings.map((f, i) => (
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
              {f.n} {f.name}
            </div>
            <p
              style={{
                marginBottom: 6,
                color: "block" in f && f.block
                  ? "var(--paper-stamp-block)"
                  : "var(--paper-ink)",
                textWrap: "pretty",
              }}
            >
              {f.text}
            </p>
            <div
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 10,
                color: "var(--paper-muted)",
              }}
            >
              {f.cite}
            </div>
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
            {recommendation}
          </p>
        </div>

        {/* Required actions */}
        <h2 style={memoH2}>Required actions</h2>
        <ol style={{ paddingLeft: 20, marginBottom: 56 }}>
          {requiredActions.map((a, i) => (
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
          Generated by Mandate · Cursor SDK · Specter · 2026-04-30 16:42:18 UTC
        </div>
      </article>
    </div>
  );
}
