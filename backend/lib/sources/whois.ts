import { cached, isForceFixtures } from "../cache";

export interface WhoisRecord {
  domain: string;
  creationDate: string;
  registrar: string;
}

const enabled = (process.env.WHOIS_LIVE ?? "false").toLowerCase() === "true";

async function live(_domain: string): Promise<never> {
  if (!enabled || isForceFixtures()) {
    throw new Error("whois:disabled-or-forced-fixture");
  }
  throw new Error("whois:live-not-implemented");
}

export async function whoisLookup(domain: string) {
  // Each domain has its own fixture; fall back to a stub when unknown.
  const safe = domain.replace(/[^a-z0-9.-]/gi, "_");
  return cached<WhoisRecord>(
    `whois:${safe}`,
    () => live(domain),
    { fixturePath: `fixtures/whois/${safe}.json` },
  );
}
