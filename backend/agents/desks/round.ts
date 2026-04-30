import type { Citation, DeskFinding } from "../../lib/contract";
import { getSpecterTransactions } from "../../lib/sources/specter";
import type { DeskRunner } from "../../lib/types";
import { round2, sleep } from "../../lib/util";

function median(xs: number[]): number {
  if (xs.length === 0) return 0;
  const s = xs.slice().sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 0 ? (s[mid - 1] + s[mid]) / 2 : s[mid];
}

function stddev(xs: number[]): number {
  if (xs.length === 0) return 0;
  const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
  const v = xs.reduce((a, b) => a + (b - mean) ** 2, 0) / xs.length;
  return Math.sqrt(v);
}

export const runRoundDesk: DeskRunner = async (deal, _mandate, send, ctx) => {
  const start = Date.now();
  send({ type: "desk.start", desk: "round" });
  await sleep(4000);
  send({ type: "desk.progress", desk: "round", message: "computing comparables" });

  const { value: tx, cached: txCached } = await getSpecterTransactions({
    sector: deal.round.sector,
    stage: deal.round.stage,
    geography: deal.round.geography,
    sinceMonths: 12,
  });

  const sizes = tx.map((t) => t.amountUsd);
  const posts = tx.map((t) => t.postMoneyUsd);
  const mSize = median(sizes);
  const mPost = median(posts);
  const sigSize = stddev(sizes) || 1;

  const spa = ctx.files.spa;
  const offBy = spa ? Math.abs(spa.roundSizeUsd - mSize) / sigSize : 0;
  const proRataReconciles =
    spa && deal.totalAllocationUsd
      ? Math.abs(deal.amountUsd - (spa.proRataPct / 100) * deal.totalAllocationUsd) < 1000
      : false;

  const citations: Citation[] = [
    {
      source: "specter",
      ref: `transactions:n=${tx.length}`,
      detail: `${tx.length} ${deal.round.sector}/${deal.round.stage}/${deal.round.geography} comparables, last 12 months`,
      cached: txCached,
    },
    {
      source: "spa",
      ref: "spa.parsed",
      detail: spa
        ? `Round ${(spa.roundSizeUsd / 1e6).toFixed(0)}M @ post ${(spa.valuationPostMoneyUsd / 1e6).toFixed(0)}M; lead ${spa.leadInvestor}; pro-rata ${spa.proRataPct}%`
        : "SPA not provided",
    },
  ];
  for (const c of citations) send({ type: "desk.citation", desk: "round", citation: c });

  let status: DeskFinding["status"] = "pass";
  let confidence = 0.87;
  if (offBy > 2) {
    status = "flag";
    confidence = 0.6;
  }
  if (spa && !proRataReconciles) {
    status = "flag";
    confidence = Math.min(confidence, 0.65);
  }

  const facts = [
    spa
      ? `Round $${(spa.roundSizeUsd / 1e6).toFixed(0)}M @ $${(spa.valuationPostMoneyUsd / 1e6).toFixed(0)}M post`
      : "No SPA parsed",
    `Comparable median: $${(mSize / 1e6).toFixed(0)}M @ $${(mPost / 1e6).toFixed(0)}M; off-by ${offBy.toFixed(2)}σ`,
    proRataReconciles
      ? `Pro-rata math reconciles ($${(deal.amountUsd / 1e6).toFixed(0)}M = ${spa?.proRataPct}% of $${((deal.totalAllocationUsd ?? 0) / 1e6).toFixed(0)}M)`
      : "Pro-rata math not verified",
  ];

  return {
    desk: "round",
    number: "04",
    title: "ROUND DYNAMICS DESK",
    status,
    confidence: round2(confidence),
    durationMs: Date.now() - start,
    primary: spa
      ? `$${(spa.roundSizeUsd / 1e6).toFixed(0)}M @ $${(spa.valuationPostMoneyUsd / 1e6).toFixed(0)}M post`
      : "round dynamics",
    facts,
    citations,
  };
};
