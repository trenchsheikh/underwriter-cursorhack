"use client";

/**
 * App shell.
 *
 * Centralised state:
 *   - route, theme, toast — UI
 *   - amendments + mergeAmendment — shared by Mandate "New PR" modal
 *     and Run "Override and amend" flow
 *   - runId, verdictAction — published up by RunScreen so MemoScreen
 *     can fetch the right /api/memo/[runId] when the user navigates
 *
 * Backend reachability is probed once on mount; if the probe fails we
 * gate the whole app behind an unreachable overlay.
 */

import { useCallback, useEffect, useState } from "react";
import { LeftRail } from "./components/LeftRail";
import { MandateScreen } from "./components/MandateScreen";
import { RunScreen } from "./components/RunScreen";
import { MemoScreen } from "./components/MemoScreen";
import { Toast } from "./components/Toast";
import { BackendUnreachable } from "./components/BackendUnreachable";
import { INITIAL_AMENDMENTS } from "./state/initial";
import type { Amendment, Route, Theme } from "./state/types";
import { probeBackend } from "./lib/api";

type ProbeStage =
  | { kind: "checking" }
  | { kind: "ok" }
  | { kind: "down" };

export default function App() {
  const [route, setRoute] = useState<Route>("mandate");
  const [theme, setTheme] = useState<Theme>("dark");
  const [toast, setToast] = useState("");
  const [amendments, setAmendments] = useState<Amendment[]>(INITIAL_AMENDMENTS);
  const [runId, setRunId] = useState<string | null>(null);
  const [, setVerdictAction] = useState<"proceed" | "review" | "hold" | null>(
    null,
  );
  const [probe, setProbe] = useState<ProbeStage>({ kind: "checking" });

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  const runProbe = useCallback(() => {
    setProbe({ kind: "checking" });
    const ac = new AbortController();
    probeBackend(ac.signal)
      .then((ok) => setProbe(ok ? { kind: "ok" } : { kind: "down" }))
      .catch(() => setProbe({ kind: "down" }));
    return () => ac.abort();
  }, []);

  useEffect(() => runProbe(), [runProbe]);

  const mandateVersion = amendments[0]?.id ? amendments[0].id - 2 : 12;
  const nextAmendmentId = Math.max(...amendments.map((a) => a.id), 0) + 1;

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
            go={setRoute}
            setToast={setToast}
            nextAmendmentId={nextAmendmentId}
            onMergeAmendment={mergeAmendment}
            publishRunId={setRunId}
            publishVerdict={setVerdictAction}
          />
        )}
        {route === "memo" && (
          <MemoScreen runId={runId} go={setRoute} />
        )}
      </main>
      <Toast message={toast} />
      {probe.kind !== "ok" && (
        <BackendUnreachable
          stage={probe.kind}
          onRetry={runProbe}
        />
      )}
    </div>
  );
}
