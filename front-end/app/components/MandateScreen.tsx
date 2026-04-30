"use client";

import { useState } from "react";
import { Icon } from "./Icon";
import { CreatePRModal } from "./CreatePRModal";
import { MANDATE_BODY, MANDATE_FRONTMATTER } from "../state/initial";
import type { Amendment } from "../state/types";

interface Props {
  amendments: Amendment[];
  setAmendments: React.Dispatch<React.SetStateAction<Amendment[]>>;
  setToast: (s: string) => void;
}

export function MandateScreen({ amendments, setAmendments, setToast }: Props) {
  const [openDiff, setOpenDiff] = useState<number | null>(null);
  const [showPRModal, setShowPRModal] = useState(false);

  const nextId = Math.max(...amendments.map((a) => a.id)) + 1;

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column" }}>
      {/* Top bar */}
      <div
        className="top-bar"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "14px 24px",
          borderBottom: "1px solid var(--border-subtle)",
          fontFamily: "var(--font-mono)",
          fontSize: 12,
          color: "var(--ink-tertiary)",
          background: "var(--surface-0)",
          flexShrink: 0,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span
            style={{
              color: "var(--ink-primary)",
              textTransform: "uppercase",
              letterSpacing: "0.08em",
            }}
          >
            Mandate
          </span>
          <span>·</span>
          <span>acme-ventures-iii</span>
          <span>·</span>
          <span>v {amendments[0]?.id ? amendments[0].id - 2 : 12}</span>
          <span>·</span>
          <span>last amended {amendments[0]?.date ?? "—"}</span>
        </div>
        <a
          className="btn-ghost"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            fontSize: 12,
            color: "var(--ink-secondary)",
          }}
          href="#"
        >
          edit on github <Icon name="external-link" size={12} />
        </a>
      </div>

      {/* Two-pane */}
      <div
        style={{
          flex: 1,
          display: "grid",
          gridTemplateColumns: "60fr 40fr",
          overflow: "hidden",
        }}
      >
        {/* LEFT — document */}
        <div
          style={{
            overflow: "auto",
            padding: "48px 64px",
            borderRight: "1px solid var(--border-subtle)",
          }}
        >
          <div
            style={{
              background: "var(--surface-1)",
              border: "1px solid var(--border-default)",
              borderRadius: 6,
              padding: 24,
              fontFamily: "var(--font-mono)",
              fontSize: 12,
              lineHeight: "18px",
              color: "var(--ink-secondary)",
              whiteSpace: "pre",
              marginBottom: 40,
              overflowX: "auto",
            }}
          >
            <div
              style={{
                color: "var(--ink-tertiary)",
                fontSize: 10,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                marginBottom: 12,
              }}
            >
              yaml · frontmatter
            </div>
            {MANDATE_FRONTMATTER}
          </div>
          <div style={{ maxWidth: "70ch" }}>
            {MANDATE_BODY.map((node, i) => {
              if (node.tag === "h1")
                return (
                  <h1
                    key={i}
                    style={{
                      fontFamily: "var(--font-display)",
                      fontStyle: "italic",
                      fontSize: 32,
                      fontWeight: 400,
                      color: "var(--ink-primary)",
                      marginBottom: 16,
                      lineHeight: 1.1,
                    }}
                  >
                    {node.text}
                  </h1>
                );
              if (node.tag === "h2")
                return (
                  <h2
                    key={i}
                    style={{
                      fontFamily: "var(--font-display)",
                      fontSize: 20,
                      fontWeight: 400,
                      color: "var(--ink-primary)",
                      marginTop: 32,
                      marginBottom: 8,
                    }}
                  >
                    {node.text}
                  </h2>
                );
              return (
                <p
                  key={i}
                  style={{
                    fontFamily: "var(--font-sans)",
                    fontSize: 14,
                    lineHeight: "24px",
                    color: "var(--ink-primary)",
                    marginBottom: 12,
                    textWrap: "pretty",
                  }}
                >
                  {node.text}
                </p>
              );
            })}
          </div>
        </div>

        {/* RIGHT — amendment log */}
        <div
          style={{
            overflow: "auto",
            padding: "48px 32px",
            background: "var(--surface-0)",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 16,
            }}
          >
            <div className="section-heading">Amendment log</div>
            <button
              onClick={() => setShowPRModal(true)}
              className="btn"
              style={{
                padding: "8px 12px",
                background: "var(--surface-1)",
                border: "1px solid var(--border-default)",
                color: "var(--ink-primary)",
                fontSize: 12,
                gap: 6,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "var(--surface-2)";
                e.currentTarget.style.borderColor = "var(--border-strong)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "var(--surface-1)";
                e.currentTarget.style.borderColor = "var(--border-default)";
              }}
            >
              <Icon name="git-pull-request" size={12} />
              New PR
            </button>
          </div>
          <div
            style={{ display: "flex", flexDirection: "column", gap: 12 }}
          >
            {amendments.map((a) => (
              <div
                key={a.id}
                className={a.fresh ? "fade-up" : undefined}
                style={{
                  background: "var(--surface-1)",
                  border: "1px solid var(--border-default)",
                  borderRadius: 6,
                  padding: 16,
                  position: "relative",
                  borderLeftWidth: a.active ? 0 : 1,
                }}
              >
                {a.active && (
                  <div
                    style={{
                      position: "absolute",
                      left: 0,
                      top: 12,
                      bottom: 12,
                      width: 2,
                      background: "var(--status-pass)",
                    }}
                  />
                )}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "baseline",
                  }}
                >
                  <span
                    className="mono"
                    style={{ fontSize: 12, color: "var(--ink-primary)" }}
                  >
                    PR #{a.id}
                  </span>
                  <span
                    className="mono"
                    style={{ fontSize: 11, color: "var(--ink-tertiary)" }}
                  >
                    {a.date} · {a.author}
                  </span>
                </div>
                <div
                  style={{
                    height: 1,
                    background: "var(--border-subtle)",
                    margin: "12px 0",
                  }}
                />
                <div
                  style={{
                    fontSize: 13,
                    color: "var(--ink-primary)",
                    lineHeight: "20px",
                    textWrap: "pretty",
                  }}
                >
                  {a.summary}
                </div>
                {a.attachments && a.attachments.length > 0 && (
                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: 6,
                      marginTop: 10,
                    }}
                  >
                    {a.attachments.map((f, i) => (
                      <span
                        key={i}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 6,
                          background: "var(--surface-2)",
                          borderRadius: 2,
                          padding: "4px 8px",
                          fontFamily: "var(--font-mono)",
                          fontSize: 10,
                          color: "var(--ink-secondary)",
                        }}
                      >
                        <Icon name={f.icon ?? "file-text"} size={10} />
                        {f.name}
                        <span style={{ color: "var(--ink-tertiary)" }}>
                          · {f.size}
                        </span>
                      </span>
                    ))}
                  </div>
                )}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginTop: 12,
                  }}
                >
                  <span
                    className="mono"
                    style={{ fontSize: 11, color: "var(--ink-tertiary)" }}
                  >
                    {a.lines} lines
                  </span>
                  <button
                    className="btn-ghost mono"
                    style={{
                      fontSize: 11,
                      padding: "4px 8px",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 4,
                    }}
                    onClick={() =>
                      setOpenDiff(openDiff === a.id ? null : a.id)
                    }
                  >
                    {openDiff === a.id ? "hide diff" : "view diff"}{" "}
                    <Icon name="external-link" size={11} />
                  </button>
                </div>
                {openDiff === a.id && (
                  <div
                    style={{
                      marginTop: 12,
                      background: "var(--surface-0)",
                      border: "1px solid var(--border-subtle)",
                      borderRadius: 4,
                      padding: 12,
                      fontFamily: "var(--font-mono)",
                      fontSize: 11,
                      lineHeight: "18px",
                      overflowX: "auto",
                    }}
                  >
                    {a.diff.map((line, i) => {
                      const added = line.startsWith("+");
                      const removed = line.startsWith("-");
                      return (
                        <div
                          key={i}
                          style={{
                            background: added
                              ? "rgba(91, 206, 145, 0.06)"
                              : removed
                              ? "rgba(229, 72, 77, 0.06)"
                              : "transparent",
                            color: added
                              ? "var(--status-pass)"
                              : removed
                              ? "var(--status-block)"
                              : "var(--ink-secondary)",
                            padding: "0 4px",
                            whiteSpace: "pre",
                          }}
                        >
                          {line}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {showPRModal && (
        <CreatePRModal
          nextId={nextId}
          onClose={() => setShowPRModal(false)}
          onSubmit={(pr) => {
            setAmendments((prev) => [
              { ...pr, fresh: true },
              ...prev.map((a) => ({ ...a, active: false, fresh: false })),
            ]);
            setShowPRModal(false);
            setToast(`PR #${pr.id} merged · MANDATE v ${pr.id + 1}`);
            setTimeout(() => setToast(""), 1800);
          }}
        />
      )}
    </div>
  );
}

