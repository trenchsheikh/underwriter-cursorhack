/**
 * End-to-end smoke test for the UnderWriter backend.
 *
 *   npm run smoke
 *
 * Hits the dev server at http://localhost:3001 (override with BASE).
 * Exercises the clean and BEC seeded scenarios:
 *   1. POST /api/run with each fixture seed; consume the SSE stream.
 *   2. GET  /api/memo/{runId}.
 *   3. For BEC, POST /api/amend with the override context.
 *
 * Returns non-zero exit on any failure / unexpected verdict.
 */

import type { RunEvent, MemoData, AmendmentDraft } from "../lib/contract";

const BASE = process.env.BASE ?? "http://localhost:3001";

const PROMPT = `Wire $2,000,000 to Acme Robotics for their Series A. Lead is Sequoia. 50% pro-rata of our $4,000,000 allocation. SPA and wire instructions attached.`;
const DEX_PROMPT = `Wire $2,650,000 to Dex for their Seed. Lead is Andreessen Horowitz. 50% pro-rata of our $5,300,000 allocation. SPA attached.`;

interface ScenarioResult {
  runId: string;
  events: RunEvent[];
  verdict: Extract<RunEvent, { type: "verdict" }>["verdict"] | null;
}

async function runScenario(
  seed: "clean-acme" | "bec-acme" | "dex-meetdex",
): Promise<ScenarioResult> {
  const body = {
    prompt: seed === "dex-meetdex" ? DEX_PROMPT : PROMPT,
    files: [
      {
        name: seed === "dex-meetdex" ? "dex_spa.pdf" : "acme_spa.pdf",
        mime: "application/pdf",
        size: 0,
        ref: "spa",
      },
      seed === "bec-acme"
        ? { name: "wire_instructions_bec.eml", mime: "message/rfc822", size: 0, ref: "wi-bec" }
        : { name: "wire_instructions_clean.pdf", mime: "application/pdf", size: 0, ref: "wi-clean" },
    ],
    fixtureSeed: seed,
  };

  const res = await fetch(`${BASE}/api/run`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok || !res.body) throw new Error(`/api/run: ${res.status}`);

  const events: RunEvent[] = [];
  let runId = "";
  let verdict: ScenarioResult["verdict"] = null;

  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let idx;
    while ((idx = buf.indexOf("\n\n")) !== -1) {
      const chunk = buf.slice(0, idx);
      buf = buf.slice(idx + 2);
      const line = chunk.split("\n").find((l) => l.startsWith("data: "));
      if (!line) continue;
      const ev = JSON.parse(line.slice(6)) as RunEvent;
      events.push(ev);
      if (ev.type === "run.init") runId = ev.run.runId;
      if (ev.type === "verdict") verdict = ev.verdict;
      const tag = ev.type;
      const detail =
        tag === "desk.start"
          ? ev.desk
          : tag === "desk.resolved"
            ? `${ev.finding.desk}=${ev.finding.status} (${ev.finding.confidence})`
            : tag === "verdict"
              ? `${ev.verdict.action} (${ev.verdict.summary})`
              : tag === "memo.ready"
                ? ev.memoId
                : tag === "run.init"
                  ? ev.run.runId
                  : "";
      console.log(`  [${seed}] ${tag} ${detail}`);
    }
  }

  return { runId, events, verdict };
}

async function fetchMemo(runId: string): Promise<MemoData> {
  const res = await fetch(`${BASE}/api/memo/${runId}`);
  if (!res.ok) throw new Error(`/api/memo: ${res.status}`);
  return (await res.json()) as MemoData;
}

async function postAmend(runId: string, blockingDesk: string, blockingReason: string): Promise<AmendmentDraft> {
  const res = await fetch(`${BASE}/api/amend`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      runId,
      blockingDesk,
      blockingReason,
      clause: "wire_safety §6.2",
      rationale: "Confirmed BEC pattern; tighten policy.",
    }),
  });
  if (!res.ok) throw new Error(`/api/amend: ${res.status}`);
  return (await res.json()) as AmendmentDraft;
}

async function main(): Promise<void> {
  console.log(`> health: ${BASE}/api/health`);
  const h = await fetch(`${BASE}/api/health`).then((r) => r.json());
  console.log("  ", h);

  console.log("> running clean scenario");
  const clean = await runScenario("clean-acme");
  if (!clean.verdict || clean.verdict.action !== "proceed") {
    throw new Error(`clean: expected action=proceed, got ${clean.verdict?.action}`);
  }
  const cleanMemo = await fetchMemo(clean.runId);
  console.log("  clean memo:", {
    runId: cleanMemo.runId,
    action: cleanMemo.verdict.action,
    summary: cleanMemo.summary.slice(0, 120),
  });

  console.log("> running BEC scenario");
  const bec = await runScenario("bec-acme");
  if (!bec.verdict || bec.verdict.action !== "hold") {
    throw new Error(`bec: expected action=hold, got ${bec.verdict?.action}`);
  }
  const becMemo = await fetchMemo(bec.runId);
  console.log("  bec memo:", {
    runId: becMemo.runId,
    action: becMemo.verdict.action,
    blockingDesk: becMemo.verdict.blockingDesk,
    blockingReason: (becMemo.verdict.blockingReason ?? "").slice(0, 200),
  });

  if (becMemo.verdict.blockingDesk !== "wire") {
    throw new Error(`bec: expected blockingDesk=wire, got ${becMemo.verdict.blockingDesk}`);
  }

  const amend = await postAmend(bec.runId, "wire", becMemo.verdict.blockingReason ?? "");
  console.log("  amendment branch:", amend.branch);
  console.log("  amendment diff:");
  console.log(amend.diff.split("\n").map((l) => `    ${l}`).join("\n"));

  console.log("> running Dex (meetdex.ai) — SPECTER_FLOW canonical scenario");
  const dex = await runScenario("dex-meetdex");
  if (!dex.verdict || (dex.verdict.action !== "review" && dex.verdict.action !== "hold")) {
    throw new Error(`dex: expected action=review|hold, got ${dex.verdict?.action}`);
  }
  const dexMemo = await fetchMemo(dex.runId);

  // SPECTER_FLOW.md §4 promises these flags must surface for Dex.
  const founderFinding = dexMemo.findings.find((f) => f.desk === "founder");
  const founderFactsBlob = (founderFinding?.facts ?? []).join("\n");
  const expectedFlags = [
    "founder_departed_before_close",
    "ex_founder_now_at_investor",
  ];
  for (const code of expectedFlags) {
    if (!founderFactsBlob.includes(code)) {
      throw new Error(`dex: founder desk did not surface ${code}`);
    }
  }

  console.log("  dex memo:", {
    runId: dexMemo.runId,
    action: dexMemo.verdict.action,
    summary: dexMemo.summary.slice(0, 160),
  });
  console.log(
    "  dex specter-driven flags surfaced via Founder desk:",
    expectedFlags.join(", "),
  );

  console.log("\nALL CHECKS PASSED");
}

main().catch((err) => {
  console.error("smoke failed:", err);
  process.exit(1);
});
