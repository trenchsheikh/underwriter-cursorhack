import { cached, isForceFixtures } from "../cache";

export interface SanctionsHit {
  id: string;
  name: string;
  list: string;
  match: number;
}

export interface SanctionsResult {
  query: string;
  hits: SanctionsHit[];
  pep: boolean;
}

const apiKey = process.env.OPENSANCTIONS_API_KEY ?? "";

async function live(_path: string): Promise<never> {
  if (!apiKey || isForceFixtures()) {
    throw new Error("os:no-key-or-forced-fixture");
  }
  throw new Error("os:live-not-implemented");
}

export async function sanctionsScreen(name: string): Promise<{ value: SanctionsResult; cached: boolean }> {
  return cached<SanctionsResult>(
    `os:screen:${name}`,
    () => live(`/match/default?q=${encodeURIComponent(name)}`),
    { fixturePath: "fixtures/opensanctions/acme-screen.json" },
  );
}

export async function pepScreen(name: string): Promise<{ value: SanctionsResult; cached: boolean }> {
  return cached<SanctionsResult>(
    `os:pep:${name}`,
    () => live(`/search/default?q=${encodeURIComponent(name)}&schema=Person`),
    { fixturePath: "fixtures/opensanctions/acme-screen.json" },
  );
}
