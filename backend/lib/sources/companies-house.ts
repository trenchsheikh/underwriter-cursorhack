import { cached, isForceFixtures } from "../cache";

export interface CompaniesHouseProfile {
  company_number: string;
  company_name: string;
  company_status: "active" | "dissolved" | "liquidation";
  date_of_creation: string;
  registered_office_address: { address_line_1: string; locality: string; country: string };
  sic_codes: string[];
  officers: Array<{ name: string; role: string; appointed_on: string }>;
  persons_with_significant_control: Array<{ name: string; nature_of_control: string[] }>;
}

const apiKey = process.env.COMPANIES_HOUSE_API_KEY ?? "";

async function live(_path: string): Promise<never> {
  if (!apiKey || isForceFixtures()) {
    throw new Error("ch:no-key-or-forced-fixture");
  }
  throw new Error("ch:live-not-implemented");
}

export async function searchCompaniesHouse(name: string) {
  return cached<{ items: Array<{ company_number: string; title: string }> }>(
    `ch:search:${name}`,
    () => live(`/search/companies?q=${encodeURIComponent(name)}`),
    { fixturePath: "fixtures/companies-house/search.json" },
  );
}

export async function getCompaniesHouseProfile(companyNumber: string) {
  return cached<CompaniesHouseProfile>(
    `ch:company:${companyNumber}`,
    () => live(`/company/${companyNumber}`),
    { fixturePath: "fixtures/companies-house/13427891.json" },
  );
}
