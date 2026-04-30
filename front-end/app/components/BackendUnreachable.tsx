"use client";

import { Icon } from "./Icon";
import { BACKEND_URL } from "../lib/api";

interface Props {
  stage: "checking" | "down";
  onRetry: () => void;
}

export function BackendUnreachable({ stage, onRetry }: Props) {
  return (
    <div
      className="fade-in"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.72)",
        zIndex: 200,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          background: "var(--surface-2)",
          border: "1px solid var(--border-default)",
          borderRadius: 6,
          padding: 32,
          maxWidth: 460,
          width: "calc(100% - 48px)",
          textAlign: "center",
          boxShadow: "0 32px 80px rgba(0,0,0,0.6)",
        }}
      >
        {stage === "checking" ? (
          <>
            <div
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 12,
                color: "var(--ink-secondary)",
                marginBottom: 16,
              }}
            >
              <span className="dot live pulse" style={{ marginRight: 8 }} />
              Probing backend
            </div>
            <div
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 11,
                color: "var(--ink-tertiary)",
              }}
            >
              {BACKEND_URL}
            </div>
          </>
        ) : (
          <>
            <div
              style={{
                color: "var(--status-block)",
                display: "inline-flex",
                alignItems: "center",
                gap: 10,
                fontSize: 14,
                fontWeight: 500,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                marginBottom: 12,
              }}
            >
              <Icon name="alert-triangle" size={16} />
              Backend unreachable
            </div>
            <p
              style={{
                fontSize: 14,
                lineHeight: "22px",
                color: "var(--ink-primary)",
                marginBottom: 4,
                textWrap: "pretty",
              }}
            >
              The Mandate frontend can&rsquo;t reach the diligence engine.
            </p>
            <p
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 11,
                color: "var(--ink-tertiary)",
                marginBottom: 24,
              }}
            >
              Tried: {BACKEND_URL}
            </p>
            <p
              style={{
                fontSize: 13,
                lineHeight: "20px",
                color: "var(--ink-secondary)",
                marginBottom: 24,
                textWrap: "pretty",
              }}
            >
              Start the backend with{" "}
              <code className="mono" style={{ color: "var(--ink-primary)" }}>
                cd backend && npm run dev
              </code>{" "}
              (it listens on <span className="mono">:3001</span>), then retry.
            </p>
            <button
              className="btn btn-primary"
              onClick={onRetry}
              style={{ minWidth: 120 }}
            >
              Retry
            </button>
          </>
        )}
      </div>
    </div>
  );
}
