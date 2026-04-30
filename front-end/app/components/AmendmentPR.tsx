"use client";

import { useEffect, useState } from "react";
import { Icon } from "./Icon";
import { draftAmendment } from "../lib/amend";
import type { AmendmentDraft, OverrideContext } from "../lib/contract";
import type { Amendment } from "../state/types";

interface Props {
  override: OverrideContext;
  /** Local PR number for the new Amendment row. */
  nextId: number;
  onCancel: () => void;
  /** Called with the merged Amendment (constructed from the backend draft). */
  onApprove: (a: Amendment) => void;
}

type Stage =
  | { kind: "loading" }
  | { kind: "ready"; draft: AmendmentDraft }
  | { kind: "error"; message: string };

export function AmendmentPR({ override, nextId, onCancel, onApprove }: Props) {
  const [stage, setStage] = useState<Stage>({ kind: "loading" });

  useEffect(() => {
    const ac = new AbortController();
    draftAmendment(override, ac.signal)
      .then((draft) => setStage({ kind: "ready", draft }))
      .catch((err: Error) => {
        if (ac.signal.aborted) return;
        setStage({ kind: "error", message: err.message });
      });
    return () => ac.abort();
  }, [override]);

  const merge = () => {
    if (stage.kind !== "ready") return;
    const { draft } = stage;
    const diffLines = draft.diff.split("\n");
    const lines = formatLineCount(diffLines);
    const merged: Amendment = {
      id: nextId,
      date: new Date().toISOString().slice(0, 10),
      author: "Mandate · agent",
      summary: draft.prTitle,
      lines,
      diff: diffLines,
      active: true,
      prUrl: draft.prUrl,
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
          AMENDMENT PR · #{nextId}
          {stage.kind === "ready" && stage.draft.branch && (
            <>
              {" · branch: "}
              {stage.draft.branch}
            </>
          )}
        </div>
        <div
          style={{
            height: 1,
            background: "var(--border-subtle)",
            margin: "16px 0",
          }}
        />

        {stage.kind === "loading" && (
          <div style={{ padding: "32px 0", textAlign: "center" }}>
            <div
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 13,
                color: "var(--ink-primary)",
                marginBottom: 12,
              }}
            >
              <span className="dot live pulse" style={{ marginRight: 10 }} />
              Drafting amendment with Cursor Composer
            </div>
            <div
              style={{
                height: 2,
                width: "60%",
                margin: "16px auto",
                background: "var(--surface-3)",
                overflow: "hidden",
                borderRadius: 1,
              }}
            >
              <div
                style={{
                  width: "40%",
                  height: 2,
                  background: "var(--status-live)",
                  animation: "indeterminate 1.4s ease-in-out infinite",
                }}
              />
            </div>
          </div>
        )}

        {stage.kind === "error" && (
          <div style={{ padding: "32px 0", textAlign: "center" }}>
            <div
              style={{
                color: "var(--status-block)",
                fontFamily: "var(--font-mono)",
                fontSize: 13,
                marginBottom: 16,
              }}
            >
              <Icon name="alert-triangle" size={14} /> Drafting failed: {stage.message}
            </div>
            <button className="btn btn-secondary" onClick={onCancel}>
              Close
            </button>
          </div>
        )}

        {stage.kind === "ready" && (
          <DraftBody
            draft={stage.draft}
            onCancel={onCancel}
            onApprove={merge}
          />
        )}
      </div>
    </>
  );
}

function DraftBody({
  draft,
  onCancel,
  onApprove,
}: {
  draft: AmendmentDraft;
  onCancel: () => void;
  onApprove: () => void;
}) {
  return (
    <>
      {/* Title */}
      <div
        style={{
          fontFamily: "var(--font-display)",
          fontStyle: "italic",
          fontSize: 22,
          color: "var(--ink-primary)",
          marginBottom: 16,
          lineHeight: 1.2,
        }}
      >
        {draft.prTitle}
      </div>

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

      {/* Diff render */}
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
        {draft.diff.split("\n").map((line, i) => {
          const tag = classifyDiff(line);
          const bg =
            tag === "add"
              ? "rgba(91,206,145,0.07)"
              : tag === "rm"
              ? "rgba(229,72,77,0.07)"
              : "transparent";
          const color =
            tag === "add"
              ? "var(--status-pass)"
              : tag === "rm"
              ? "var(--status-block)"
              : tag === "meta"
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
                  tag === "add"
                    ? `fade-up 200ms ease-out ${i * 30}ms backwards`
                    : "none",
              }}
            >
              {line}
            </div>
          );
        })}
      </div>

      <div className="section-heading" style={{ marginBottom: 8 }}>
        Rationale
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
          whiteSpace: "pre-wrap",
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
        {draft.prBody}
      </div>

      {draft.prUrl && (
        <div style={{ marginBottom: 24 }}>
          <a
            href={draft.prUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mono"
            style={{
              fontSize: 11,
              color: "var(--ink-secondary)",
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            View on GitHub <Icon name="external-link" size={11} />
          </a>
        </div>
      )}

      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
        <button className="btn btn-secondary" onClick={onCancel}>
          Request changes
        </button>
        <button className="btn btn-primary" onClick={onApprove}>
          Approve & merge
        </button>
      </div>
    </>
  );
}

function classifyDiff(line: string): "add" | "rm" | "meta" | "ctx" {
  if (line.startsWith("@@")) return "meta";
  if (line.startsWith("++") || line.startsWith("--")) return "meta";
  if (line.startsWith("+")) return "add";
  if (line.startsWith("-")) return "rm";
  return "ctx";
}

function formatLineCount(diffLines: string[]): string {
  let adds = 0;
  let rms = 0;
  for (const line of diffLines) {
    if (line.startsWith("++") || line.startsWith("--")) continue;
    if (line.startsWith("+")) adds++;
    else if (line.startsWith("-")) rms++;
  }
  if (adds === 0 && rms === 0) return "+0";
  if (adds > 0 && rms === 0) return `+${adds}`;
  if (adds === 0 && rms > 0) return `−${rms}`; // en-dash U+2212
  return `~${Math.max(adds, rms)}`;
}
