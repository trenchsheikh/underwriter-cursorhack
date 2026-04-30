import type { DeskFinding, DeskId, RunEvent, RunRequest } from "../lib/contract";
import { holdWire, queueWire } from "../lib/ledger";
import { loadMandate } from "../lib/mandate-loader";
import { parseSPA, parseWireInstructions } from "../lib/sources/pdf-parse";
import type { FundState, ParsedDeal, ParsedFiles, SendFn } from "../lib/types";
import { newRunId, nowIso, withTimeout } from "../lib/util";

import { runCompanyDesk } from "./desks/company";
import { runFounderDesk } from "./desks/founder";
import { runInvestorDesk } from "./desks/investor";
import { runMandateDesk } from "./desks/mandate";
import { runRoundDesk } from "./desks/round";
import { runWireSafetyDesk } from "./desks/wire-safety";
import { getMemo, renderMemo, saveMemo } from "./memo";
import { parsePrompt } from "./parse-prompt";
import { synthesise } from "./synthesise";
import { loadFixture } from "../lib/cache";

const DESK_TIMEOUT_MS = 30_000;

const DESKS: { id: DeskId; number: string; title: string; runner: typeof runCompanyDesk }[] = [
  { id: "company",  number: "01", title: "COMPANY DESK",        runner: runCompanyDesk },
  { id: "founder",  number: "02", title: "FOUNDER DESK",        runner: runFounderDesk },
  { id: "investor", number: "03", title: "LEAD INVESTOR DESK",  runner: runInvestorDesk },
  { id: "round",    number: "04", title: "ROUND DYNAMICS DESK", runner: runRoundDesk },
  { id: "mandate",  number: "05", title: "MANDATE DESK",        runner: runMandateDesk },
  { id: "wire",     number: "06", title: "WIRE SAFETY DESK",    runner: runWireSafetyDesk },
];

export async function runOrchestrator(
  req: RunRequest,
  send: SendFn,
): Promise<{ runId: string }> {
  const runId = newRunId();
  const mandate = await loadMandate();

  const deal = parsePrompt(req);
  if (!deal) {
    send({ type: "error", message: "Could not parse the deal from the prompt." });
    return { runId };
  }

  send({
    type: "run.init",
    run: {
      runId,
      startedAt: nowIso(),
      mandateVersion: mandate.version,
      fundId: mandate.fund.id,
    },
  });

  const fundState = await loadFixture<FundState>("fixtures/fund-state.json");
  const files = await assembleFiles(req);

  const settled = await Promise.allSettled(
    DESKS.map((d) => runOneDesk(d, deal, mandate, send, fundState, files)),
  );

  const findings: DeskFinding[] = settled.map((r, i) => {
    if (r.status === "fulfilled") return r.value;
    const d = DESKS[i];
    const fallback: DeskFinding = {
      desk: d.id,
      number: d.number as DeskFinding["number"],
      title: d.title,
      status: "flag",
      confidence: 0.5,
      durationMs: 0,
      primary: "could not complete check",
      facts: [`internal error: ${String(r.reason).slice(0, 200)}`],
      citations: [],
    };
    send({ type: "desk.resolved", finding: fallback });
    return fallback;
  });

  const verdict = synthesise(findings, mandate);
  send({ type: "verdict", verdict });

  if (verdict.action === "hold") {
    holdWire(runId, verdict.blockingReason ?? "blocked", deal.amountUsd, deal.company.name);
  } else if (verdict.action === "proceed") {
    queueWire({
      runId,
      amountUsd: deal.amountUsd,
      recipient: deal.company.name,
      status: "queued",
    });
  }

  const memo = await renderMemo(runId, deal, mandate, findings, verdict);
  saveMemo(runId, memo);
  send({ type: "memo.ready", memoId: runId });

  return { runId };
}

async function runOneDesk(
  d: (typeof DESKS)[number],
  deal: ParsedDeal,
  mandate: Awaited<ReturnType<typeof loadMandate>>,
  send: SendFn,
  fundState: FundState,
  files: ParsedFiles,
): Promise<DeskFinding> {
  try {
    const finding = await withTimeout(
      d.runner(deal, mandate, send, { fundState, files }),
      DESK_TIMEOUT_MS,
      `desk ${d.id} timed out after ${DESK_TIMEOUT_MS}ms`,
    );
    send({ type: "desk.resolved", finding });
    return finding;
  } catch (err) {
    const finding: DeskFinding = {
      desk: d.id,
      number: d.number as DeskFinding["number"],
      title: d.title,
      status: "flag",
      confidence: 0.5,
      durationMs: 0,
      primary: "could not complete check",
      facts: [`internal error: ${String(err).slice(0, 200)}`],
      citations: [],
    };
    send({ type: "desk.resolved", finding });
    return finding;
  }
}

async function assembleFiles(req: RunRequest): Promise<ParsedFiles> {
  const variant: "clean" | "bec" =
    req.fixtureSeed === "bec-acme" ||
    req.files.some((f) => /\.eml$/i.test(f.name) || /bec/i.test(f.name) || /bec/i.test(f.ref))
      ? "bec"
      : "clean";

  const [spa, wireInstructions] = await Promise.all([
    parseSPA("acme_spa.pdf").catch(() => undefined),
    parseWireInstructions(variant).catch(() => undefined),
  ]);

  return { wireInstructionsKey: variant, spa, wireInstructions };
}

export { getMemo };
