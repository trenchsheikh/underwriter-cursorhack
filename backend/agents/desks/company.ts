import type { Citation, DeskFinding } from "../../lib/contract";
import {
  getCompaniesHouseProfile,
  searchCompaniesHouse,
} from "../../lib/sources/companies-house";
import { getSpecterCompany } from "../../lib/sources/specter";
import type { DeskRunner } from "../../lib/types";
import { round2, sleep } from "../../lib/util";

export const runCompanyDesk: DeskRunner = async (deal, _mandate, send) => {
  const start = Date.now();
  send({ type: "desk.start", desk: "company" });
  await sleep(2000);
  send({ type: "desk.progress", desk: "company", message: "resolving domain → enrichment" });

  const domain = deal.company.domainHint ?? "acme.co";
  const [{ value: specter, cached: specterCached }, { value: search, cached: chSearchCached }] =
    await Promise.all([
      getSpecterCompany(domain),
      searchCompaniesHouse(deal.company.name),
    ]);

  const number = search.items[0]?.company_number ?? "13427891";
  const { value: ch, cached: chCached } = await getCompaniesHouseProfile(number);

  const citations: Citation[] = [
    {
      source: "specter",
      ref: specter.id,
      detail: `${specter.name} · ${specter.headcount} FTE · ${specter.status}`,
      cached: specterCached,
    },
    {
      source: "companies-house",
      ref: ch.company_number,
      detail: `${ch.company_name} · status ${ch.company_status} · inc. ${ch.date_of_creation}`,
      cached: chCached || chSearchCached,
    },
  ];

  for (const c of citations) send({ type: "desk.citation", desk: "company", citation: c });

  const status: DeskFinding["status"] =
    ch.company_status !== "active" ? "block" : "pass";
  const inc = new Date(ch.date_of_creation);
  const ageDays = (Date.now() - inc.getTime()) / 86_400_000;
  const yearMatch = Math.abs(specter.foundedYear - inc.getFullYear()) <= 1;

  const facts = [
    `Inc. ${ch.date_of_creation} · ${ch.registered_office_address.locality}, ${ch.registered_office_address.country}`,
    `${specter.headcount} FTE · status ${ch.company_status}`,
    `Founded year cross-check: Specter ${specter.foundedYear} ↔ registry ${inc.getFullYear()} ${yearMatch ? "✓" : "⚠"}`,
  ];

  const confidence = round2(
    status === "block" ? 0.99 : ageDays > 365 && yearMatch ? 0.94 : 0.78,
  );

  return {
    desk: "company",
    number: "01",
    title: "COMPANY DESK",
    status,
    confidence,
    durationMs: Date.now() - start,
    primary: `${specter.name} — ${ch.company_status}`,
    facts,
    citations,
  };
};
