"use client";

export function Toast({ message }: { message: string }) {
  if (!message) return null;
  return (
    <div
      className="fade-in"
      style={{
        position: "fixed",
        bottom: 24,
        left: "50%",
        transform: "translateX(-50%)",
        background: "var(--surface-3)",
        border: "1px solid var(--border-strong)",
        color: "var(--ink-primary)",
        fontFamily: "var(--font-mono)",
        fontSize: 11,
        padding: "8px 12px",
        borderRadius: 4,
        zIndex: 1000,
      }}
    >
      {message}
    </div>
  );
}
