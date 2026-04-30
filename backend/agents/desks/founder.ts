import type { Citation, DeskFinding } from "../../lib/contract";
import { pepScreen, sanctionsScreen } from "../../lib/sources/opensanctions";
import { getSpecterCompanyPeople } from "../../lib/sources/specter";
import type { DeskRunner } from "../../lib/types";
import { round2, sleep } from "../../lib/util";

export const runFounderDesk: DeskRunner = async (deal, _mandate, send) => {
  const start = Date.now();
  send({ type: "desk.start", desk: "founder" });
  await sleep(3000);
  send({ type: "desk.progress", desk: "founder", message: "screening founders" });

  const { value: people, cached: peopleCached } = await getSpecterCompanyPeople(
    deal.company.companyId,
  );

  const screens = await Promise.all(
    people.map(async (p) => {
      const [s, pep] = await Promise.all([sanctionsScreen(p.name), pepScreen(p.name)]);
      return { person: p, sanctions: s.value, pep: pep.value, sanctionsCached: s.cached, pepCached: pep.cached };
    }),
  );

  const citations: Citation[] = [
    {
      source: "specter",
      ref: people.map((p) => p.id).join(", "),
      detail: `${people.length} named founders/officers`,
      cached: peopleCached,
    },
    ...screens.flatMap((s): Citation[] => [
      {
        source: "opensanctions",
        ref: s.person.name,
        detail: s.sanctions.hits.length === 0 ? "sanctions: clear" : `sanctions: ${s.sanctions.hits.length} hit(s)`,
        cached: s.sanctionsCached,
      },
      {
        source: "opensanctions",
        ref: `pep:${s.person.name}`,
        detail: s.pep.pep ? "PEP match" : "PEP: clear",
        cached: s.pepCached,
      },
    ]),
  ];
  for (const c of citations) send({ type: "desk.citation", desk: "founder", citation: c });

  const anyHit = screens.some((s) => s.sanctions.hits.length > 0 || s.pep.pep || s.person.pep);
  const lead = people[0];
  const facts = [
    `${people.length} founders/officers checked: ${people.map((p) => p.name).join(", ")}`,
    lead ? `${lead.name}: ${lead.role}, ex-${lead.prior.join(", ")}, ${lead.exits} prior exit(s)` : "no Specter coverage",
    anyHit ? "Sanctions or PEP hit detected" : "No sanctions or PEP hits across listed founders",
  ];

  const status: DeskFinding["status"] = anyHit ? "block" : "pass";
  const confidence = round2(anyHit ? 0.99 : people.length >= 2 ? 0.91 : 0.75);

  return {
    desk: "founder",
    number: "02",
    title: "FOUNDER DESK",
    status,
    confidence,
    durationMs: Date.now() - start,
    primary: lead ? `${lead.name} — ${lead.role}` : "Founders not found",
    facts,
    citations,
  };
};
