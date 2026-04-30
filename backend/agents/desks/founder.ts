import type { Citation, DeskFinding } from "../../lib/contract";
import { pepScreen, sanctionsScreen } from "../../lib/sources/opensanctions";
import type { DeskRunner } from "../../lib/types";
import { round2, sleep } from "../../lib/util";

export const runFounderDesk: DeskRunner = async (_deal, _mandate, send, ctx) => {
  const start = Date.now();
  send({ type: "desk.start", desk: "founder" });
  await sleep(3000);
  send({ type: "desk.progress", desk: "founder", message: "screening founders" });

  const founders = ctx.specter.snapshot.founders;

  const screens = await Promise.all(
    founders.map(async (p) => {
      const [s, pep] = await Promise.all([sanctionsScreen(p.full_name), pepScreen(p.full_name)]);
      return {
        person: p,
        sanctions: s.value,
        pep: pep.value,
        sanctionsCached: s.cached,
        pepCached: pep.cached,
      };
    }),
  );

  const citations: Citation[] = [
    {
      source: "specter",
      ref: founders.map((p) => p.person_id).join(", ") || "(none)",
      detail: `${founders.length} founders enriched (incl. founder_info merge)`,
      cached: ctx.specter.cached,
    },
    ...screens.flatMap((s): Citation[] => [
      {
        source: "opensanctions",
        ref: s.person.full_name,
        detail:
          s.sanctions.hits.length === 0
            ? "sanctions: clear"
            : `sanctions: ${s.sanctions.hits.length} hit(s)`,
        cached: s.sanctionsCached,
      },
      {
        source: "opensanctions",
        ref: `pep:${s.person.full_name}`,
        detail: s.pep.pep ? "PEP match" : "PEP: clear",
        cached: s.pepCached,
      },
    ]),
  ];

  // Surface the snapshot's own underwriting flags as Desk 02 citations.
  const founderFlags = ctx.specter.snapshot.flags.filter((f) =>
    ["founder_departed_before_close", "ex_founder_now_at_investor"].includes(f.code),
  );
  for (const f of founderFlags) {
    citations.push({
      source: "specter",
      ref: f.code,
      detail: `${f.severity.toUpperCase()} — ${f.detail}`,
    });
  }

  for (const c of citations) send({ type: "desk.citation", desk: "founder", citation: c });

  const sanctionsHit = screens.some((s) => s.sanctions.hits.length > 0 || s.pep.pep);
  const blockingFlag = founderFlags.find((f) => f.severity === "block");
  const reviewFlag = founderFlags.find((f) => f.severity === "review");

  const lead = founders[0];
  const facts: string[] = [
    `${founders.length} founder(s) enriched: ${founders.map((p) => p.full_name).join(", ") || "n/a"}`,
  ];
  if (lead) {
    const employers = lead.notable_prior_employers.length
      ? `, ex-${lead.notable_prior_employers.join(", ")}`
      : "";
    const exits = lead.prior_exits > 0 ? `, ${lead.prior_exits} prior exit(s)` : "";
    facts.push(`${lead.full_name}: ${lead.current_role.title || "(no current role)"}${employers}${exits}`);
  }
  facts.push(
    sanctionsHit
      ? "Sanctions or PEP hit detected"
      : "No sanctions or PEP hits across listed founders",
  );
  for (const f of founderFlags) {
    facts.push(`${f.severity === "block" ? "✗" : "⚠"} ${f.code}: ${f.detail}`);
  }

  let status: DeskFinding["status"];
  let confidence: number;
  if (sanctionsHit || blockingFlag) {
    status = "block";
    confidence = 0.99;
  } else if (reviewFlag) {
    status = "flag";
    confidence = 0.78;
  } else {
    status = "pass";
    confidence = founders.length >= 2 ? 0.91 : 0.78;
  }

  return {
    desk: "founder",
    number: "02",
    title: "FOUNDER DESK",
    status,
    confidence: round2(confidence),
    durationMs: Date.now() - start,
    primary: lead ? `${lead.full_name} — ${lead.current_role.title || "founder"}` : "Founders not found",
    facts,
    citations,
    raw: { reasons: [...(blockingFlag ? [blockingFlag.detail] : []), ...(reviewFlag ? [reviewFlag.detail] : [])] },
  };
};
