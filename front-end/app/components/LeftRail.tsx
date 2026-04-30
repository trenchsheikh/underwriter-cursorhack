"use client";

import { Icon, type IconName } from "./Icon";
import type { Route, Theme } from "../state/types";

interface LeftRailProps {
  route: Route;
  setRoute: (r: Route) => void;
  theme: Theme;
  setTheme: (t: Theme) => void;
  mandateVersion: number;
}

const TABS: { id: Route; icon: IconName; label: string }[] = [
  { id: "mandate", icon: "scroll", label: "Mandate" },
  { id: "run",     icon: "play",   label: "Diligence" },
  { id: "memo",    icon: "file-text", label: "IC Memo" },
];

export function LeftRail({ route, setRoute, theme, setTheme, mandateVersion }: LeftRailProps) {
  return (
    <aside className="rail">
      <div className="wordmark">
        <span className="name">Mandate</span>
        <span className="loc">LDN · 26</span>
      </div>

      <div className="tabs">
        {TABS.map((t) => (
          <button
            key={t.id}
            className={`tab ${route === t.id ? "active" : ""}`}
            onClick={() => setRoute(t.id)}
            aria-label={t.label}
          >
            <Icon name={t.icon} size={14} />
            <span>{t.label}</span>
          </button>
        ))}
      </div>

      <div className="rail-meta">
        <div
          style={{
            display: "flex",
            border: "1px solid var(--border-default)",
            borderRadius: 4,
            padding: 2,
            marginBottom: 20,
          }}
        >
          {(["dark", "light"] as Theme[]).map((t) => (
            <button
              key={t}
              onClick={() => setTheme(t)}
              style={{
                flex: 1,
                padding: "6px 0",
                fontFamily: "var(--font-mono)",
                fontSize: 10,
                textTransform: "uppercase",
                letterSpacing: "0.12em",
                color: theme === t ? "var(--ink-primary)" : "var(--ink-tertiary)",
                background: theme === t ? "var(--surface-2)" : "transparent",
                borderRadius: 2,
              }}
            >
              {t}
            </button>
          ))}
        </div>
        <div className="row">
          <span>FUND</span>
          <span style={{ color: "var(--ink-tertiary)" }}>AV-III</span>
        </div>
        <div className="row">
          <span>MANDATE</span>
          <span style={{ color: "var(--ink-tertiary)" }}>v {mandateVersion}</span>
        </div>
        <div className="row">
          <span>STATUS</span>
          <span
            style={{
              color: "var(--status-pass)",
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
            }}
          >
            <span className="dot pass" /> LIVE
          </span>
        </div>
      </div>
    </aside>
  );
}
