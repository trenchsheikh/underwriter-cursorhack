import type { Citation, DeskFinding } from "../../lib/contract";
import {
  getCompaniesHouseProfile,
  searchCompaniesHouse,
} from "../../lib/sources/companies-house";
import type { DeskRunner } from "../../lib/types";
import { round2, sleep } from "../../lib/util";

export const runCompanyDesk: DeskRunner = async (deal, _mandate, send, ctx) => {
  const start = Date.now();
  send({ type: "desk.start", desk: "company" });
  await sleep(2000);
  send({
    type: "desk.progress",
    desk: "company",
    message: "specter snapshot → registry cross-check",
  });

  const company = ctx.specter.snapshot.company;
  const { value: search, cached: chSearchCached } = await searchCompaniesHouse(deal.company.name);

  // The CH fixtures are aligned with Acme; the Dex fixture is non-UK so we
  // soft-skip the registry call when Specter says HQ ≠ "United Kingdom".
  const hqIsUk = /united kingdom|uk/i.test(company.hq_country);

  const ch = hqIsUk
    ? await getCompaniesHouseProfile(search.items[0]?.company_number ?? "13427891").catch(() => null)
    : null;

  const citations: Citation[] = [
    {
      source: "specter",
      ref: company.specter_id || "(no-id)",
      detail: `${company.legal_name} · ${company.employee_count} FTE · ${company.operating_status} · ${company.hq_city}, ${company.hq_country}`,
      cached: ctx.specter.cached,
    },
  ];

  if (ch) {
    citations.push({
      source: "companies-house",
      ref: ch.value.company_number,
      detail: `${ch.value.company_name} · status ${ch.value.company_status} · inc. ${ch.value.date_of_creation}`,
      cached: ch.cached || chSearchCached,
    });
  }

  for (const c of citations) send({ type: "desk.citation", desk: "company", citation: c });

  const operatingActive = company.operating_status === "active";
  const chActive = ch ? ch.value.company_status === "active" : true;
  const status: DeskFinding["status"] = !operatingActive || !chActive ? "block" : "pass";

  const yearMatch =
    ch && company.founded_year
      ? Math.abs(company.founded_year - new Date(ch.value.date_of_creation).getFullYear()) <= 1
      : true;

  const facts: string[] = [
    `${company.legal_name} (${company.domain || "no domain"}) · founded ${company.founded_year || "?"} · HQ ${company.hq_city}${company.hq_country ? ", " + company.hq_country : ""}`,
    `${company.employee_count} FTE · growth_stage ${company.growth_stage || "n/a"} · operating_status ${company.operating_status || "n/a"}`,
  ];
  if (ch) {
    facts.push(
      `Registry cross-check: Specter founded_year ${company.founded_year} ↔ CH inc. ${new Date(ch.value.date_of_creation).getFullYear()} ${yearMatch ? "✓" : "⚠"}`,
    );
  } else if (hqIsUk) {
    facts.push("Companies House lookup unavailable; relying on Specter");
  } else {
    facts.push(`Non-UK HQ — Companies House not applicable (${company.hq_country})`);
  }
  if (company.tech_verticals.length > 0) {
    facts.push(
      `Tech verticals: ${company.tech_verticals.map((v) => v.join(" / ")).join("; ")}`,
    );
  }

  const confidence = round2(
    status === "block" ? 0.99 : yearMatch ? 0.94 : 0.78,
  );

  return {
    desk: "company",
    number: "01",
    title: "COMPANY DESK",
    status,
    confidence,
    durationMs: Date.now() - start,
    primary: `${company.legal_name} — ${company.operating_status || "unknown"}`,
    facts,
    citations,
  };
};
