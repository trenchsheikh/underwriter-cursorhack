"use client";

import { useRef, useState } from "react";
import { Icon } from "./Icon";
import type { Amendment, Attachment } from "../state/types";

interface Props {
  nextId: number;
  onClose: () => void;
  onSubmit: (pr: Amendment) => void;
}

const AUTHORS = ["A. Patel", "M. Okonkwo", "S. Lindqvist"];

export function CreatePRModal({ nextId, onClose, onSubmit }: Props) {
  const [summary, setSummary] = useState("");
  const [diffText, setDiffText] = useState(
    "  wire_safety:\n+   require_phone_confirmation_above_usd:\n+     1_000_000",
  );
  const [files, setFiles] = useState<Attachment[]>([]);
  const [author, setAuthor] = useState(AUTHORS[0]);
  const [stage, setStage] = useState<"compose" | "merging" | "merged">("compose");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const onFilePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files ?? []);
    const newFiles: Attachment[] = picked.map((f) => ({
      name: f.name,
      size: f.size > 1024 ? `${(f.size / 1024).toFixed(0)} KB` : `${f.size} B`,
      icon: f.name.endsWith(".eml") ? "mail" : "file-text",
    }));
    setFiles((prev) => [...prev, ...newFiles]);
    e.target.value = "";
  };

  const removeFile = (idx: number) =>
    setFiles((prev) => prev.filter((_, i) => i !== idx));

  const submit = () => {
    if (!summary.trim()) return;
    setStage("merging");
    setTimeout(() => {
      setStage("merged");
      const lines = diffText.split("\n");
      const adds = lines.filter((l) => l.startsWith("+")).length;
      const rms = lines.filter((l) => l.startsWith("-")).length;
      const lineLabel =
        adds && !rms ? `+${adds}` :
        !adds && rms ? `−${rms}` :
        adds || rms ? `~${adds + rms}` : "+0";
      setTimeout(() => {
        onSubmit({
          id: nextId,
          date: new Date().toISOString().slice(0, 10),
          author,
          summary: summary.trim(),
          lines: lineLabel,
          diff: lines,
          attachments: files,
          active: true,
        });
      }, 700);
    }, 900);
  };

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
          width: 720,
          maxHeight: "88vh",
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
          NEW AMENDMENT PR · #{nextId} · branch: amend/manual-{nextId}
        </div>
        <div
          style={{
            height: 1,
            background: "var(--border-subtle)",
            margin: "16px 0 24px",
          }}
        />

        {stage === "compose" && (
          <>
            <div style={{ marginBottom: 20 }}>
              <div className="section-heading" style={{ marginBottom: 8 }}>Summary</div>
              <input
                type="text"
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                placeholder="e.g. Require phone confirmation above $1M"
                style={{
                  width: "100%",
                  background: "var(--surface-1)",
                  border: "1px solid var(--border-default)",
                  borderRadius: 4,
                  padding: "10px 12px",
                  fontSize: 14,
                  color: "var(--ink-primary)",
                }}
                onFocus={(e) => (e.target.style.borderColor = "var(--border-strong)")}
                onBlur={(e) => (e.target.style.borderColor = "var(--border-default)")}
              />
            </div>

            <div style={{ marginBottom: 20 }}>
              <div className="section-heading" style={{ marginBottom: 8 }}>Author</div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {AUTHORS.map((a) => (
                  <button
                    key={a}
                    onClick={() => setAuthor(a)}
                    style={{
                      padding: "6px 10px",
                      borderRadius: 2,
                      border: "1px solid var(--border-default)",
                      background:
                        author === a ? "var(--surface-3)" : "var(--surface-1)",
                      fontFamily: "var(--font-mono)",
                      fontSize: 11,
                      color:
                        author === a ? "var(--ink-primary)" : "var(--ink-secondary)",
                    }}
                  >
                    {a}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: 20 }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "baseline",
                  marginBottom: 8,
                }}
              >
                <div className="section-heading">Diff · MANDATE.md</div>
                <span
                  className="mono"
                  style={{ fontSize: 10, color: "var(--ink-tertiary)" }}
                >
                  + adds, − removes, indent for context
                </span>
              </div>
              <textarea
                value={diffText}
                onChange={(e) => setDiffText(e.target.value)}
                rows={6}
                style={{
                  width: "100%",
                  background: "var(--surface-0)",
                  border: "1px solid var(--border-default)",
                  borderRadius: 4,
                  padding: 12,
                  fontFamily: "var(--font-mono)",
                  fontSize: 12,
                  lineHeight: "20px",
                  color: "var(--ink-primary)",
                  resize: "vertical",
                }}
              />
              <div
                style={{
                  marginTop: 8,
                  background: "var(--surface-0)",
                  border: "1px solid var(--border-subtle)",
                  borderRadius: 4,
                  padding: 10,
                  fontFamily: "var(--font-mono)",
                  fontSize: 11,
                  lineHeight: "20px",
                  maxHeight: 140,
                  overflow: "auto",
                }}
              >
                {diffText.split("\n").map((line, i) => {
                  const added = line.startsWith("+");
                  const removed = line.startsWith("-");
                  return (
                    <div
                      key={i}
                      style={{
                        background: added
                          ? "rgba(91,206,145,0.07)"
                          : removed
                          ? "rgba(229,72,77,0.07)"
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
                      {line || " "}
                    </div>
                  );
                })}
              </div>
            </div>

            <div style={{ marginBottom: 24 }}>
              <div className="section-heading" style={{ marginBottom: 8 }}>
                Supporting documents
              </div>
              <input
                type="file"
                ref={fileInputRef}
                onChange={onFilePick}
                multiple
                style={{ display: "none" }}
              />
              <div
                style={{
                  border: "1px dashed var(--border-default)",
                  borderRadius: 4,
                  padding: files.length ? "12px" : "24px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                  background: "var(--surface-1)",
                }}
              >
                {files.length === 0 && (
                  <div
                    style={{
                      textAlign: "center",
                      color: "var(--ink-tertiary)",
                      fontSize: 12,
                    }}
                  >
                    LP memo, opinion of counsel, board pack, etc.
                  </div>
                )}
                {files.length > 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {files.map((f, i) => (
                      <span
                        key={i}
                        className="fade-up"
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 8,
                          background: "var(--surface-2)",
                          borderRadius: 2,
                          padding: "6px 10px",
                          fontFamily: "var(--font-mono)",
                          fontSize: 11,
                          color: "var(--ink-secondary)",
                        }}
                      >
                        <Icon name={f.icon} size={12} />
                        {f.name}
                        <span style={{ color: "var(--ink-tertiary)" }}>
                          · {f.size}
                        </span>
                        <button
                          onClick={() => removeFile(i)}
                          style={{
                            color: "var(--ink-tertiary)",
                            display: "inline-flex",
                          }}
                        >
                          <Icon name="x" size={11} />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "center",
                    marginTop: files.length ? 4 : 0,
                  }}
                >
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      fontFamily: "var(--font-mono)",
                      fontSize: 11,
                      color: "var(--ink-secondary)",
                      textTransform: "uppercase",
                      letterSpacing: "0.06em",
                      padding: "6px 10px",
                      border: "1px solid var(--border-default)",
                      borderRadius: 2,
                      background: "var(--surface-2)",
                    }}
                  >
                    <Icon name="paperclip" size={12} />
                    Attach files
                  </button>
                </div>
              </div>
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <span
                className="mono"
                style={{ fontSize: 11, color: "var(--ink-tertiary)" }}
              >
                Will bump mandate to v {nextId + 1}
              </span>
              <div style={{ display: "flex", gap: 8 }}>
                <button className="btn btn-secondary" onClick={onClose}>
                  Cancel
                </button>
                <button
                  className="btn btn-primary"
                  disabled={!summary.trim()}
                  style={{ opacity: summary.trim() ? 1 : 0.4 }}
                  onClick={submit}
                >
                  Open & merge PR <Icon name="arrow-right" size={14} />
                </button>
              </div>
            </div>
          </>
        )}

        {stage === "merging" && (
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
              Validating diff against MANDATE schema · running checks
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

        {stage === "merged" && (
          <div style={{ padding: "32px 0", textAlign: "center" }}>
            <div
              style={{
                color: "var(--status-pass)",
                fontFamily: "var(--font-mono)",
                fontSize: 13,
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <Icon name="check" size={14} />
              Merged · MANDATE bumped to v {nextId + 1}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
