/**
 * Specter source. Backend.md §6.1.
 *
 * In the demo environment we don't have a key, so every call resolves
 * from `fixtures/specter/`. The shape of the live API is preserved so
 * swapping in real calls later is a one-line change inside `fetchLive`.
 */

import { cached, isForceFixtures } from "../cache";

export interface SpecterCompany {
  id: string;
  name: string;
  domain: string;
  foundedYear: number;
  headcount: number;
  status: "active" | "dissolved" | "in_liquidation";
  hq: string;
  lastRound?: { stage: string; amountUsd: number; investors: string[] };
}

export interface SpecterPerson {
  id: string;
  name: string;
  role: string;
  prior: string[];
  exits: number;
  pep: boolean;
}

export interface InterestSignal {
  partner: string;
  fund: string;
  signalType: string;
  at: string;
}

export interface Transaction {
  id: string;
  company: string;
  stage: string;
  sector: string;
  geography: string;
  amountUsd: number;
  postMoneyUsd: number;
  at: string;
}

export interface TransactionFilter {
  sector: string;
  stage: string;
  geography: string;
  sinceMonths: number;
}

const liveBase = process.env.SPECTER_API_BASE || "https://api.tryspecter.com";
const apiKey = process.env.SPECTER_API_KEY ?? "";

async function liveOrThrow<T>(_path: string): Promise<T> {
  if (!apiKey || isForceFixtures()) {
    throw new Error("specter:no-key-or-forced-fixture");
  }
  // The real implementation would `fetch(liveBase + _path, { headers: { Authorization: Bearer apiKey }})`.
  // We don't ship that here because the demo runs entirely on fixtures.
  throw new Error(`specter:live-not-implemented (${liveBase})`);
}

export async function getSpecterCompany(domain: string) {
  return cached<SpecterCompany>(
    `specter:company:${domain}`,
    () => liveOrThrow<SpecterCompany>(`/enrichment/companies?domain=${domain}`),
    { fixturePath: "fixtures/specter/acme-company.json" },
  );
}

export async function getSpecterCompanyPeople(companyId: string) {
  return cached<SpecterPerson[]>(
    `specter:people:${companyId}`,
    () => liveOrThrow<SpecterPerson[]>(`/companies/${companyId}/people`),
    { fixturePath: "fixtures/specter/acme-founders.json" },
  );
}

export async function getSpecterInterestSignals(
  companyId: string,
  investorName: string,
  sinceDays: number,
) {
  return cached<InterestSignal[]>(
    `specter:interest:${companyId}:${investorName}:${sinceDays}`,
    () =>
      liveOrThrow<InterestSignal[]>(
        `/investor-interest/${companyId}?investor=${encodeURIComponent(investorName)}&sinceDays=${sinceDays}`,
      ),
    { fixturePath: "fixtures/specter/sequoia-interest.json" },
  );
}

export async function getSpecterTransactions(filter: TransactionFilter) {
  return cached<Transaction[]>(
    `specter:tx:${filter.sector}:${filter.stage}:${filter.geography}:${filter.sinceMonths}`,
    () =>
      liveOrThrow<Transaction[]>(
        `/entities/text-search?sector=${filter.sector}&stage=${filter.stage}&geo=${filter.geography}`,
      ),
    { fixturePath: "fixtures/specter/eu-robotics-rounds.json" },
  );
}
