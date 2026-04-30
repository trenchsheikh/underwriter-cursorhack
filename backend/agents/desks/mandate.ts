import type { Citation, DeskFinding } from "../../lib/contract";
import { evaluateAllRules } from "../../lib/mandate-evaluator";
import type { DeskRunner } from "../../lib/types";
import { round2, sleep } from "../../lib/util";

export const runMandateDesk: DeskRunner = async (deal, mandate, send, ctx) => {
  const start = Date.now();
  send({ type: "desk.start", desk: "mandate" });
  await sleep(400);
  send({ type: "desk.progress", desk: "mandate", message: "evaluating rules" });

  const results = evaluateAllRules(mandate, deal, ctx.fundState);

  const citations: Citation[] = results.map((r) => ({
    source: "mandate",
    ref: r.sectionRef ?? r.clause,
    detail: `${r.pass ? "✓" : "✗"} ${r.detail}`,
  }));
  for (const c of citations) send({ type: "desk.citation", desk: "mandate", citation: c });

  const passes = results.filter((r) => r.pass).length;
  const total = results.length;
  const allPass = passes === total;

  const status: DeskFinding["status"] = allPass ? "pass" : "block";
  const confidence = round2(allPass ? 0.99 : 0.99);

  return {
    desk: "mandate",
    number: "05",
    title: "MANDATE DESK",
    status,
    confidence,
    durationMs: Date.now() - start,
    primary: `${passes} of ${total} rules pass`,
    facts: results.map((r) => `${r.pass ? "✓" : "✗"} ${r.sectionRef ?? r.clause}: ${r.detail}`),
    citations,
    raw: results,
  };
};
