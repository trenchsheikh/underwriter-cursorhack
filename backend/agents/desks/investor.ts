import type { Citation, DeskFinding } from "../../lib/contract";
import {
  getSpecterInterestSignals,
  getSpecterTransactions,
} from "../../lib/sources/specter";
import type { DeskRunner } from "../../lib/types";
import { round2, sleep } from "../../lib/util";

export const runInvestorDesk: DeskRunner = async (deal, mandate, send) => {
  const start = Date.now();
  send({ type: "desk.start", desk: "investor" });
  await sleep(5000);
  send({ type: "desk.progress", desk: "investor", message: "fetching interest signals" });

  const lead = deal.round.leadInvestor ?? "Sequoia Capital";
  const [{ value: signals, cached: signalsCached }, { value: tx, cached: txCached }] =
    await Promise.all([
      getSpecterInterestSignals(deal.company.companyId, lead, 60),
      getSpecterTransactions({
        sector: deal.round.sector,
        stage: deal.round.stage,
        geography: deal.round.geography,
        sinceMonths: 12,
      }),
    ]);

  const priorRoundsBySector = tx.length;
  const citations: Citation[] = [
    {
      source: "specter",
      ref: `interest-signals:${signals.length}`,
      detail: `${signals.length} engagements with ${lead} in last 60 days`,
      cached: signalsCached,
    },
    {
      source: "specter",
      ref: `comparable-rounds:${priorRoundsBySector}`,
      detail: `${priorRoundsBySector} comparable ${deal.round.sector}/${deal.round.stage} rounds in ${deal.round.geography}`,
      cached: txCached,
    },
  ];
  for (const c of citations) send({ type: "desk.citation", desk: "investor", citation: c });

  const requiredPriors = mandate.syndicateQuality.leadMustHavePriorRoundInSectorCount;

  let status: DeskFinding["status"];
  let confidence: number;
  if (signals.length === 0) {
    status = "block";
    confidence = 0.95;
  } else if (signals.length >= 3 && priorRoundsBySector >= requiredPriors) {
    status = "pass";
    confidence = 0.88;
  } else {
    status = "flag";
    confidence = 0.7;
  }

  const facts = [
    `${signals.length} ${lead} partner engagements in last 60 days`,
    `${priorRoundsBySector} prior ${deal.round.sector} rounds visible (mandate requires ${requiredPriors})`,
    signals[0]
      ? `Most recent: ${signals[0].partner} · ${signals[0].signalType} · ${signals[0].at.slice(0, 10)}`
      : "No signals available",
  ];

  return {
    desk: "investor",
    number: "03",
    title: "LEAD INVESTOR DESK",
    status,
    confidence: round2(confidence),
    durationMs: Date.now() - start,
    primary: `${lead} — ${signals.length} engagements / 60d`,
    facts,
    citations,
  };
};
