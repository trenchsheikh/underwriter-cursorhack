import type { Citation, DeskFinding } from "../../lib/contract";
import type { DeskRunner } from "../../lib/types";
import { round2, sleep } from "../../lib/util";

export const runRoundDesk: DeskRunner = async (deal, _mandate, send, ctx) => {
  const start = Date.now();
  send({ type: "desk.start", desk: "round" });
  await sleep(3000);
  send({
    type: "desk.progress",
    desk: "round",
    message: "computing comparables from Specter peer pool",
  });

  // SPECTER_FLOW.md §5 — peers are derived from /companies/{id}/similar.
  const peers = ctx.specter.snapshot.peers;
  const subject = ctx.specter.snapshot.company;
  const seedMedian = peers.seed_median_usd ?? 0;
  const subjectLastUsd = subject.funding.last_usd;

  const ratio = seedMedian > 0 ? subjectLastUsd / seedMedian : 0;
  const peerFlag = ctx.specter.snapshot.flags.find(
    (f) => f.code === "funding_outlier_high" || f.code === "funding_outlier_low",
  );

  const spa = ctx.files.spa;
  const proRataReconciles =
    spa && deal.totalAllocationUsd
      ? Math.abs(deal.amountUsd - (spa.proRataPct / 100) * deal.totalAllocationUsd) < 1000
      : false;

  const citations: Citation[] = [
    {
      source: "specter",
      ref: `peers:n=${peers.n_total}`,
      detail: `${peers.n_total} similar companies; ${peers.direct_matches.length} share ≥1 tech_vertical`,
      cached: ctx.specter.cached,
    },
    {
      source: "specter",
      ref: "peers.caveat",
      detail: peers.caveat,
      cached: ctx.specter.cached,
    },
    {
      source: "spa",
      ref: "spa.parsed",
      detail: spa
        ? `Round ${(spa.roundSizeUsd / 1e6).toFixed(0)}M @ post ${(spa.valuationPostMoneyUsd / 1e6).toFixed(0)}M; lead ${spa.leadInvestor}; pro-rata ${spa.proRataPct}%`
        : "SPA not provided",
    },
  ];
  if (peerFlag) {
    citations.push({
      source: "specter",
      ref: peerFlag.code,
      detail: `${peerFlag.severity.toUpperCase()} — ${peerFlag.detail}`,
    });
  }
  for (const c of citations) send({ type: "desk.citation", desk: "round", citation: c });

  let status: DeskFinding["status"] = "pass";
  let confidence = 0.87;
  if (peerFlag) {
    status = "flag";
    confidence = 0.65;
  }
  if (spa && !proRataReconciles) {
    status = "flag";
    confidence = Math.min(confidence, 0.65);
  }

  const facts: string[] = [
    `${subject.funding.last_type || "Round"} ${(subjectLastUsd / 1e6).toFixed(1)}M closed ${subject.funding.last_date || "?"}`,
    seedMedian > 0
      ? `Peer ${subject.growth_stage || "stage"} median: $${(seedMedian / 1e6).toFixed(1)}M; subject = ${ratio.toFixed(2)}× median`
      : `Peer median unavailable (n=${peers.n_total})`,
  ];
  if (peers.direct_matches.length > 0) {
    const head = peers.direct_matches.slice(0, 2);
    facts.push(
      `Direct matches: ${head.map((p) => `${p.name} ${(p.last_funding_usd / 1e6).toFixed(1)}M`).join(", ")}`,
    );
  }
  if (spa) {
    facts.push(
      proRataReconciles
        ? `Pro-rata math reconciles ($${(deal.amountUsd / 1e6).toFixed(1)}M = ${spa.proRataPct}% of $${((deal.totalAllocationUsd ?? 0) / 1e6).toFixed(1)}M)`
        : "Pro-rata math not verified against SPA",
    );
  }

  return {
    desk: "round",
    number: "04",
    title: "ROUND DYNAMICS DESK",
    status,
    confidence: round2(confidence),
    durationMs: Date.now() - start,
    primary: spa
      ? `$${(spa.roundSizeUsd / 1e6).toFixed(0)}M @ $${(spa.valuationPostMoneyUsd / 1e6).toFixed(0)}M post`
      : `${subject.funding.last_type || "round"} ${(subjectLastUsd / 1e6).toFixed(1)}M`,
    facts,
    citations,
  };
};
