import type { Citation, DeskFinding } from "../../lib/contract";
import type { DeskRunner } from "../../lib/types";
import { round2, sleep } from "../../lib/util";

export const runInvestorDesk: DeskRunner = async (deal, mandate, send, ctx) => {
  const start = Date.now();
  send({ type: "desk.start", desk: "investor" });
  await sleep(2500);
  send({
    type: "desk.progress",
    desk: "investor",
    message: "evaluating syndicate via Specter snapshot",
  });

  // SPECTER_FLOW.md §7 — investor-interest endpoint is NOT WIRED. Desk 03
  // falls back to `funding.investors[]` + the highlight-driven tile.
  const company = ctx.specter.snapshot.company;
  const investors = company.funding.investors;
  const tier1 = mandate.syndicateQuality.tier1Funds.map((s) => s.toLowerCase());
  const tier1Hits = investors.filter((inv) => tier1.some((t) => inv.toLowerCase().includes(t)));

  const requestedLead = deal.round.leadInvestor ?? investors[0] ?? "";
  const presentLead = investors.find(
    (inv) => requestedLead && inv.toLowerCase().includes(requestedLead.toLowerCase()),
  );

  const recencyFlag = company.highlights.includes("raised_last_month")
    ? "raised_last_month"
    : company.highlights.includes("recent_funding")
      ? "recent_funding"
      : company.highlights.includes("no_recent_funding")
        ? "no_recent_funding"
        : "";

  const citations: Citation[] = [
    {
      source: "specter",
      ref: company.specter_id || "(no-id)",
      detail: `${investors.length} investors on record · last round ${company.funding.last_type || "n/a"} ${(company.funding.last_usd / 1e6).toFixed(1)}M on ${company.funding.last_date || "?"}`,
      cached: ctx.specter.cached,
    },
    {
      source: "specter",
      ref: "highlights",
      detail: company.highlights.length > 0 ? company.highlights.join(", ") : "no highlights",
      cached: ctx.specter.cached,
    },
    {
      source: "mandate",
      ref: "syndicate_quality.tier1_funds",
      detail: `${tier1Hits.length}/${investors.length} on tier-1 list (${tier1Hits.join("; ") || "none"})`,
    },
  ];
  for (const c of citations) send({ type: "desk.citation", desk: "investor", citation: c });

  const tier1Required = company.funding.last_usd >= mandate.syndicateQuality.tier1LeadRequiredAboveUsd;

  let status: DeskFinding["status"];
  let confidence: number;
  if (investors.length === 0) {
    status = "block";
    confidence = 0.95;
  } else if (tier1Required && tier1Hits.length === 0) {
    status = "flag";
    confidence = 0.72;
  } else if (tier1Hits.length > 0 && (recencyFlag === "raised_last_month" || recencyFlag === "recent_funding")) {
    status = "pass";
    confidence = 0.9;
  } else {
    status = "flag";
    confidence = 0.78;
  }

  const facts: string[] = [
    `Investors: ${investors.slice(0, 6).join(", ")}${investors.length > 6 ? `, +${investors.length - 6} more` : ""}`,
    `Tier-1 hits: ${tier1Hits.length > 0 ? tier1Hits.join(", ") : "none"} (mandate threshold $${(mandate.syndicateQuality.tier1LeadRequiredAboveUsd / 1e6).toFixed(0)}M)`,
    presentLead
      ? `Stated lead "${requestedLead}" present in cap table ✓`
      : `Stated lead "${requestedLead || "(unspecified)"}" not in cap table ⚠`,
    recencyFlag
      ? `Recency: ${recencyFlag} highlight set`
      : "Recency: no funding-recency highlight",
  ];
  facts.push(
    "Investor-interest endpoint is NOT WIRED in this build (SPECTER_FLOW §7); using highlight-driven fallback.",
  );

  return {
    desk: "investor",
    number: "03",
    title: "LEAD INVESTOR DESK",
    status,
    confidence: round2(confidence),
    durationMs: Date.now() - start,
    primary: presentLead
      ? `${presentLead} — ${tier1Hits.length} tier-1 hit(s)`
      : `${requestedLead || "lead unknown"} — ${tier1Hits.length} tier-1 hit(s)`,
    facts,
    citations,
  };
};
