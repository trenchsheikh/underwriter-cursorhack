import type { DeskFinding, MemoData, Verdict } from "../lib/contract";
import { chatComplete } from "../lib/sources/llm";
import type { Mandate, ParsedDeal } from "../lib/types";
import { nowIso } from "../lib/util";

const memoStore = new Map<string, MemoData>();

export async function renderMemo(
  runId: string,
  deal: ParsedDeal,
  mandate: Mandate,
  findings: DeskFinding[],
  verdict: Verdict,
): Promise<MemoData> {
  const summary = await editorialSummary(deal, mandate, findings, verdict);
  const recommendation = recommendationLine(deal, verdict);
  const requiredActions = requiredActionsList(verdict, findings);

  const memo: MemoData = {
    runId,
    fund: { name: mandate.fund.name, id: mandate.fund.id },
    deal: {
      company: deal.company.name,
      round: humanStage(deal.round.stage),
      amountUsd: deal.amountUsd,
      proRataPct: deal.proRataPct,
    },
    verdict,
    findings,
    summary,
    recommendation,
    requiredActions,
    generatedAt: nowIso(),
  };
  return memo;
}

export function saveMemo(runId: string, memo: MemoData): void {
  memoStore.set(runId, memo);
}

export function getMemo(runId: string): MemoData | undefined {
  return memoStore.get(runId);
}

function humanStage(stage: ParsedDeal["round"]["stage"]): string {
  switch (stage) {
    case "pre_seed":
      return "Pre-Seed";
    case "seed":
      return "Seed";
    case "series_a":
      return "Series A";
    case "series_b":
      return "Series B";
    default:
      return "Other";
  }
}

function recommendationLine(deal: ParsedDeal, verdict: Verdict): string {
  switch (verdict.action) {
    case "proceed":
      return `Proceed with $${deal.amountUsd.toLocaleString("en-US")} into ${deal.company.name} per the signing matrix.`;
    case "review":
      return `Bring ${deal.company.name} to partner review before any wire.`;
    case "hold":
      return `Do not wire to ${deal.company.name}. Hold pending out-of-band confirmation per wire_safety §6.4.`;
  }
}

function requiredActionsList(verdict: Verdict, findings: DeskFinding[]): string[] {
  if (verdict.action === "hold") {
    const reasons = findings.find((f) => f.status === "block")?.facts ?? [];
    return [
      "Out-of-band phone confirmation per wire_safety §6.4",
      "Re-screen receiving entity if details change",
      ...reasons.slice(1, 4).map((r) => `Address: ${r}`),
    ];
  }
  if (verdict.action === "review") {
    return findings
      .filter((f) => f.status === "flag")
      .map((f) => `Partner review of ${f.title}: ${f.primary}`);
  }
  return [
    "Two-signer sign-off per signing matrix",
    "Confirm wire instructions on file with operations",
  ];
}

async function editorialSummary(
  deal: ParsedDeal,
  mandate: Mandate,
  findings: DeskFinding[],
  verdict: Verdict,
): Promise<string> {
  // Try LLM; fall back to a deterministic template if unavailable.
  const passes = findings.filter((f) => f.status === "pass").length;
  const blocks = findings.filter((f) => f.status === "block");
  const flags = findings.filter((f) => f.status === "flag");

  const fallback = (() => {
    if (verdict.action === "hold") {
      const b = blocks[0];
      return `${deal.company.name} fails wire safety: ${b?.primary ?? "blocking finding"}. ${passes} of ${findings.length} desks passed; the wire is held pending out-of-band confirmation.`;
    }
    if (verdict.action === "review") {
      return `${deal.company.name} clears most checks but ${flags.length} desk(s) flagged: ${flags.map((f) => f.title).join(", ")}. Partner review required.`;
    }
    return `${deal.company.name} clears all ${findings.length} desks at joint confidence ${verdict.confidence.toFixed(2)}. The deal is within ${mandate.fund.name} mandate; the wire is queued for two-signer sign-off.`;
  })();

  const llm = await chatComplete({
    system:
      "You are a venture-capital underwriting analyst. Write a 2–3 sentence editorial summary of a diligence run, factual, no hype, no claims beyond the inputs.",
    user: `Fund: ${mandate.fund.name}\nCompany: ${deal.company.name}\nRound: ${deal.round.stage} ${deal.amountUsd}\nVerdict: ${verdict.action} (${verdict.summary})\nFindings: ${findings.map((f) => `${f.title}=${f.status} (${f.primary})`).join("; ")}\n`,
    maxTokens: 180,
  });

  return llm ?? fallback;
}
