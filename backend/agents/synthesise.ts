import type { DeskFinding, Verdict } from "../lib/contract";
import type { Mandate } from "../lib/types";
import { round2 } from "../lib/util";

/**
 * Pure synthesis. Spec: Backend.md §8.
 *
 * Action rules, in order:
 *   1. Any `block` → action `hold`, blockingDesk = first blocking desk.
 *   2. Any `flag` OR confidence < flag_for_review_below → action `review`.
 *   3. Else `proceed`.
 *
 * Joint confidence = geometric product of desk confidences.
 */
export function synthesise(findings: DeskFinding[], mandate: Mandate): Verdict {
  const blocks = findings.filter((f) => f.status === "block");
  const flags = findings.filter((f) => f.status === "flag");
  const passes = findings.filter((f) => f.status === "pass");

  const productConf = findings.reduce((acc, f) => acc * f.confidence, 1);
  const joinedConf = round2(productConf);

  if (blocks.length > 0) {
    const b = blocks[0];
    const reason =
      typeof b.raw === "object" && b.raw && "reasons" in b.raw
        ? ((b.raw as { reasons: string[] }).reasons.join("; ") || b.primary)
        : b.primary;
    return {
      action: "hold",
      confidence: joinedConf,
      summary: `HOLD — ${blocks.length} blocking finding(s); ${flags.length} flag(s); ${passes.length} pass(es)`,
      blockingDesk: b.desk,
      blockingReason: reason,
    };
  }

  const lowConfidence = findings.some(
    (f) => f.confidence < mandate.calibration.flagForReviewBelow,
  );
  if (flags.length > 0 || lowConfidence) {
    return {
      action: "review",
      confidence: joinedConf,
      summary: `REVIEW — ${flags.length} flag(s); ${passes.length} pass(es)`,
    };
  }

  return {
    action: "proceed",
    confidence: joinedConf,
    summary: `PROCEED — ${passes.length}/${findings.length} desks pass`,
  };
}
