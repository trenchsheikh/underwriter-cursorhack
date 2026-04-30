import { readFile } from "node:fs/promises";
import { join } from "node:path";

import type { AmendmentDraft, OverrideContext } from "../lib/contract";
import { chatComplete } from "../lib/sources/llm";

/**
 * Draft an amendment to MANDATE.md based on the GP's override context.
 * Backend.md §10. We don't open a real PR in the demo.
 */
export async function draftAmendment(
  override: OverrideContext,
): Promise<AmendmentDraft> {
  const path = join(/* turbopackIgnore: true */ process.cwd(), "MANDATE.md");
  await readFile(path, "utf8").catch(() => "");

  const branch = `amend/${override.blockingDesk}-${override.runId}`;
  const diff = buildDiff(override);
  const rationale = await rationaleFor(override);

  const prTitle = `[Mandate] amend ${override.clause} after run ${override.runId}`;
  const prBody = [
    `### Rationale`,
    rationale,
    "",
    `### Triggering run`,
    `- Run: \`${override.runId}\``,
    `- Blocking desk: \`${override.blockingDesk}\``,
    `- Reason: ${override.blockingReason}`,
    "",
    `### Diff`,
    "```diff",
    diff,
    "```",
  ].join("\n");

  return {
    runId: override.runId,
    branch,
    diff,
    prTitle,
    prBody,
    // prUrl is intentionally not populated in the demo path.
  };
}

function buildDiff(o: OverrideContext): string {
  if (o.blockingDesk === "wire") {
    return [
      "@@ MANDATE.md",
      "   wire_safety:",
      "     domain_age_min_days: 30",
      "     domain_edit_distance_block: 2",
      `+    blocked_domains_seen_in_attacks:`,
      `+      # added from run ${o.runId}`,
      `+      - ${extractDomain(o.blockingReason) ?? "unknown"}`,
    ].join("\n");
  }
  return [
    "@@ MANDATE.md",
    `   # Amendment triggered by ${o.blockingDesk} desk`,
    `+  # Run ${o.runId}: ${o.blockingReason}`,
  ].join("\n");
}

function extractDomain(reason: string): string | null {
  // Pull any domain-shaped token; prefer the lookalike (first non-canonical).
  const tokens = reason.match(/[a-z0-9-]+\.[a-z]{2,}/gi) ?? [];
  const canonical = new Set(["acme.co"]);
  const lookalike = tokens.find((t) => !canonical.has(t.toLowerCase()));
  return lookalike ?? tokens[0] ?? null;
}

async function rationaleFor(o: OverrideContext): Promise<string> {
  const llm = await chatComplete({
    system:
      "You are a venture-fund counsel drafting a mandate amendment. Write 2 sentences explaining why the policy is being tightened, factual.",
    user: `Blocking desk: ${o.blockingDesk}\nClause: ${o.clause}\nReason: ${o.blockingReason}\nGP rationale: ${o.rationale ?? "(none provided)"}\n`,
    maxTokens: 140,
  });
  if (llm) return llm;
  return [
    `On run ${o.runId}, the ${o.blockingDesk} desk fired a block: ${o.blockingReason}.`,
    `This amendment captures the lesson so future runs are checked against the same pattern.`,
  ].join(" ");
}
