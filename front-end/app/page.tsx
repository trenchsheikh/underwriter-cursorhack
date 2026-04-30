"use client";

/**
 * App shell for the Mandate prototype.
 *
 * State (all lives here so a single screen can be swapped without prop-drill):
 *   - route        : which tab in the rail is active
 *   - theme        : dark | light, mirrored to <html data-theme="...">
 *   - amendments   : the PR/amendment log shown on the Mandate screen.
 *                    The Create-PR modal pushes new entries here.
 *   - toast        : transient bottom-center message
 *
 * Mandate-only state lives inside MandateScreen (which diff is open, modal open?).
 *
 * To extend this app (Run, Memo) drop the matching component into the
 * route switch below — they receive whatever slice of state they need.
 */

import { useEffect, useState } from "react";
import { LeftRail } from "./components/LeftRail";
import { MandateScreen } from "./components/MandateScreen";
import { Toast } from "./components/Toast";
import { INITIAL_AMENDMENTS } from "./state/initial";
import type { Amendment, Route, Theme } from "./state/types";

export default function App() {
  const [route, setRoute] = useState<Route>("mandate");
  const [theme, setTheme] = useState<Theme>("dark");
  const [toast, setToast] = useState("");
  const [amendments, setAmendments] = useState<Amendment[]>(INITIAL_AMENDMENTS);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  // Mandate "version" is bumped each time a PR merges. The latest PR id
  // anchors the displayed version (matches the design: PR #14 → v 12).
  const mandateVersion = amendments[0]?.id ? amendments[0].id - 2 : 12;

  return (
    <div className="app" data-screen-label={`Mandate · ${route}`}>
      <LeftRail
        route={route}
        setRoute={setRoute}
        theme={theme}
        setTheme={setTheme}
        mandateVersion={mandateVersion}
      />
      <main
        className="main"
        data-screen-label={
          route === "mandate" ? "01 Mandate" :
          route === "run"     ? "02 Diligence Run" :
                                "03 IC Memo"
        }
      >
        {route === "mandate" && (
          <MandateScreen
            amendments={amendments}
            setAmendments={setAmendments}
            setToast={setToast}
          />
        )}
        {route === "run" && <ComingSoon label="Diligence Run" />}
        {route === "memo" && <ComingSoon label="IC Memo" />}
      </main>
      <Toast message={toast} />
    </div>
  );
}

function ComingSoon({ label }: { label: string }) {
  return (
    <div
      style={{
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "var(--ink-tertiary)",
        fontFamily: "var(--font-display)",
        fontStyle: "italic",
        fontSize: 28,
      }}
    >
      {label} — coming soon
    </div>
  );
}
