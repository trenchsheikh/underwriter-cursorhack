"use client";

/**
 * App shell for the Mandate prototype.
 *
 * Centralised state — all three screens read from / write to it:
 *   - route       : which tab in the rail is active
 *   - theme       : dark | light, mirrored to <html data-theme>
 *   - amendments  : PR/amendment log; mutated by Mandate's Create-PR modal
 *                   AND by the Run screen's "Override and amend" flow
 *   - runState    : everything about the current diligence run; Memo reads
 *                   it to decide PROCEED vs HOLD
 *   - toast       : transient bottom-center message
 *
 * Per-screen UI state (which diff is expanded, which modal is open) lives
 * inside the screen component.
 */

import { useEffect, useState, useCallback } from "react";
import { LeftRail } from "./components/LeftRail";
import { MandateScreen } from "./components/MandateScreen";
import { RunScreen } from "./components/RunScreen";
import { MemoScreen } from "./components/MemoScreen";
import { Toast } from "./components/Toast";
import { INITIAL_AMENDMENTS } from "./state/initial";
import { INITIAL_RUN_STATE } from "./state/fixtures";
import type { Amendment, Route, RunState, Theme } from "./state/types";

export default function App() {
  const [route, setRoute] = useState<Route>("mandate");
  const [theme, setTheme] = useState<Theme>("dark");
  const [toast, setToast] = useState("");
  const [amendments, setAmendments] = useState<Amendment[]>(INITIAL_AMENDMENTS);
  const [runState, setRunState] = useState<RunState>(INITIAL_RUN_STATE);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  const mandateVersion = amendments[0]?.id ? amendments[0].id - 2 : 12;
  const nextAmendmentId =
    Math.max(...amendments.map((a) => a.id), 0) + 1;

  /**
   * Push a fresh amendment onto the log. Used by both the Mandate "New PR"
   * modal and the Run "Override and amend" flow, so it lives here.
   */
  const mergeAmendment = useCallback((a: Amendment) => {
    setAmendments((prev) => [
      { ...a, fresh: true },
      ...prev.map((p) => ({ ...p, active: false, fresh: false })),
    ]);
  }, []);

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
        {route === "run" && (
          <RunScreen
            runState={runState}
            setRunState={setRunState}
            go={setRoute}
            setToast={setToast}
            nextAmendmentId={nextAmendmentId}
            onMergeAmendment={mergeAmendment}
          />
        )}
        {route === "memo" && (
          <MemoScreen runState={runState} go={setRoute} />
        )}
      </main>
      <Toast message={toast} />
    </div>
  );
}
