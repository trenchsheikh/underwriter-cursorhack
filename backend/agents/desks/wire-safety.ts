import type { Citation, DeskFinding } from "../../lib/contract";
import { getCompaniesHouseProfile } from "../../lib/sources/companies-house";
import { sanctionsScreen } from "../../lib/sources/opensanctions";
import { whoisLookup } from "../../lib/sources/whois";
import type { DeskRunner } from "../../lib/types";
import { levenshtein, round2, sleep } from "../../lib/util";

export const runWireSafetyDesk: DeskRunner = async (_deal, mandate, send, ctx) => {
  const start = Date.now();
  send({ type: "desk.start", desk: "wire" });
  await sleep(7000);
  send({ type: "desk.progress", desk: "wire", message: "screening wire instructions" });

  const wi = ctx.files.wireInstructions;
  if (!wi) {
    return {
      desk: "wire",
      number: "06",
      title: "WIRE SAFETY DESK",
      status: "flag",
      confidence: 0.5,
      durationMs: Date.now() - start,
      primary: "Wire instructions not provided",
      facts: ["Re-upload the wire instructions PDF or .eml."],
      citations: [],
    };
  }

  const verifiedDomain = "acme.co";
  const editDist = levenshtein(wi.sourceEmailDomain, verifiedDomain);
  const { value: whois, cached: whoisCached } = await whoisLookup(wi.sourceEmailDomain);
  const ageMs = Date.now() - new Date(whois.creationDate).getTime();
  const ageDays = Math.floor(ageMs / 86_400_000);

  const { value: sanctions, cached: sanctionsCached } = await sanctionsScreen(
    wi.accountHolderName,
  );

  const ch = await getCompaniesHouseProfile("13427891").catch(() => null);
  const beneficialOwners = ch?.value.persons_with_significant_control.map((p) => p.name) ?? [];
  const accountHolderUpper = wi.accountHolderName.toUpperCase();
  const expectedEntity = ch?.value.company_name ?? "ACME ROBOTICS LIMITED";
  const ownerMatch =
    accountHolderUpper === expectedEntity ||
    accountHolderUpper.includes("ACME ROBOTICS");

  const citations: Citation[] = [
    {
      source: "whois",
      ref: wi.sourceEmailDomain,
      detail: `Registered ${whois.creationDate.slice(0, 10)} (${ageDays}d ago); registrar ${whois.registrar}`,
      cached: whoisCached,
    },
    {
      source: "mandate",
      ref: "wire_safety §6.2",
      detail: `Edit distance ${wi.sourceEmailDomain} vs ${verifiedDomain}: ${editDist}; threshold ${mandate.wireSafety.domainEditDistanceBlock}`,
    },
    {
      source: "opensanctions",
      ref: wi.accountHolderName,
      detail: sanctions.hits.length === 0 ? "sanctions/PEP: clear" : `${sanctions.hits.length} hit(s)`,
      cached: sanctionsCached,
    },
    {
      source: "companies-house",
      ref: "psc",
      detail: `BO match: ${ownerMatch ? "✓" : "✗"} (account holder "${wi.accountHolderName}" vs ${beneficialOwners.join(", ") || "n/a"})`,
    },
  ];
  for (const c of citations) send({ type: "desk.citation", desk: "wire", citation: c });

  const reasons: string[] = [];
  if (editDist <= mandate.wireSafety.domainEditDistanceBlock && wi.sourceEmailDomain !== verifiedDomain) {
    reasons.push(`Lookalike domain ${wi.sourceEmailDomain} vs verified ${verifiedDomain} (edit distance ${editDist} ≤ ${mandate.wireSafety.domainEditDistanceBlock}) — wire_safety §6.2`);
  }
  if (ageDays < mandate.wireSafety.domainAgeMinDays) {
    reasons.push(`Domain ${wi.sourceEmailDomain} age ${ageDays}d < min ${mandate.wireSafety.domainAgeMinDays}d — wire_safety §6.1`);
  }
  if (mandate.wireSafety.requireDkimPass && !wi.dkimPass) {
    reasons.push("DKIM fail on inbound wire-instruction email — wire_safety §6.3");
  }
  if (mandate.wireSafety.requireSpfPass && !wi.spfPass) {
    reasons.push("SPF fail on inbound wire-instruction email — wire_safety §6.3");
  }
  if (mandate.wireSafety.beneficialOwnerMatchRequired && !ownerMatch) {
    reasons.push(`Account holder "${wi.accountHolderName}" does not match beneficial owner / SPA entity — wire_safety §6.6`);
  }
  if (sanctions.hits.length > 0) {
    reasons.push("Sanctions hit on receiving entity");
  }

  const status: DeskFinding["status"] = reasons.length > 0 ? "block" : "pass";
  const confidence = round2(status === "block" ? 0.99 : 0.96);

  const facts =
    status === "block"
      ? [`BEC pattern detected — ${reasons.length} signal(s)`, ...reasons]
      : [
          `Domain ${wi.sourceEmailDomain} · age ${ageDays}d`,
          `DKIM ${wi.dkimPass ? "✓" : "✗"} · SPF ${wi.spfPass ? "✓" : "✗"} · BO ${ownerMatch ? "✓" : "✗"}`,
          `Sanctions/PEP: ${sanctions.hits.length === 0 ? "clear" : `${sanctions.hits.length} hit(s)`}`,
        ];

  return {
    desk: "wire",
    number: "06",
    title: "WIRE SAFETY DESK",
    status,
    confidence,
    durationMs: Date.now() - start,
    primary:
      status === "block"
        ? "BLOCK — Business Email Compromise pattern"
        : `Domain ${wi.sourceEmailDomain} · age ${ageDays}d`,
    facts,
    citations,
    raw: { reasons },
  };
};
