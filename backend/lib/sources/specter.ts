/**
 * Specter source. Implementation of `backend/docs/SPECTER_FLOW.md`.
 *
 * Public surface:
 *   - `buildSpecterSnapshot(seed | url)` → `SpecterSnapshot` (the object the
 *     desks consume). This is the §1–§5 + §4 cross-step flow rolled up.
 *   - `getSpecterSnapshotFixture(seed)` for the fixture-only path.
 *
 * Private surface:
 *   - Endpoint wrappers (`postCompanies`, `getCompanyPeople`, `getPerson`,
 *     `getSimilar`, `getCompanyById`) that match the documented HTTP shape:
 *     `X-API-Key` auth, `https://app.tryspecter.com/api/v1` base, the error
 *     semantics described in §0 of the spec.
 *
 * Live mode is gated by `SPECTER_API_KEY` and disabled by `DEMO_FORCE_FIXTURES`
 * / `OFFLINE_MODE`. The demo defaults to fixtures so that the underwriter
 * runs cleanly with no keys configured.
 */

import { isForceFixtures, loadFixture } from "../cache";

// ---------------------------------------------------------------------
// Public snapshot type — exactly the shape Desk 01-04 consume.
// Lifted from SPECTER_FLOW.md §8.
// ---------------------------------------------------------------------

export interface SpecterCompanyBlock {
  specter_id: string;
  legal_name: string;
  domain: string;
  hq_city: string;
  hq_country: string;
  founded_year: number;
  employee_count: number;
  growth_stage: string;
  operating_status: string;
  tech_verticals: [string, string][];
  industries: string[];
  tagline: string;
  description: string;
  funding: {
    total_usd: number;
    last_type: string;
    last_usd: number;
    last_date: string;
    investors: string[];
    round_count: number;
  };
  highlights: string[];
  new_highlights: string[];
  traction: {
    web_visits_latest: number;
    headcount_6mo_change: number;
    linkedin_followers_latest: number;
  };
}

export interface SpecterFounderBlock {
  person_id: string;
  full_name: string;
  tagline: string;
  linkedin_url: string;
  location: string;
  years_of_experience: number;
  highlights: string[];
  education_top: { school: string; degree: string } | null;
  current_role: { title: string; company_name: string | null; is_current: boolean };
  /** Computed §3b. */
  prior_exits: number;
  /** Computed §3b. */
  stealth_history: boolean;
  /** Computed §3b / §4a. */
  departed_subject_company: { end_date: string; days_before_close: number } | null;
  talent_signal_ids: string[] | null;
  investor_signal_ids: string[] | null;
  notable_prior_employers: string[];
}

export interface SpecterPeersBlock {
  n_total: number;
  seed_median_usd: number | null;
  seed_mean_usd: number | null;
  range_usd: [number, number] | null;
  direct_matches: Array<{
    specter_id: string;
    name: string;
    last_funding_usd: number;
    last_funding_type: string;
    last_funding_date: string;
    investors: string[];
  }>;
  caveat: string;
}

export interface SpecterFlag {
  code: string;
  severity: "info" | "review" | "block";
  detail: string;
  citations: string[];
}

export interface SpecterSnapshot {
  fetched_at: string;
  company: SpecterCompanyBlock;
  founders: SpecterFounderBlock[];
  peers: SpecterPeersBlock;
  flags: SpecterFlag[];
}

// ---------------------------------------------------------------------
// Snapshot resolution input.
// ---------------------------------------------------------------------

export type SnapshotSeed = "dex-meetdex" | "clean-acme" | "bec-acme";

export interface SnapshotRequest {
  /** A canonical scenario seed; resolves directly from a fixture snapshot. */
  seed?: SnapshotSeed;
  /** Live path — used when `SPECTER_API_KEY` is configured and not in offline mode. */
  websiteUrl?: string;
  /** A previously-resolved specter id (skips step 1's enrichment). */
  specterId?: string;
}

const SNAPSHOT_FIXTURE: Record<SnapshotSeed, string> = {
  "dex-meetdex": "fixtures/specter/snapshots/dex.json",
  "clean-acme": "fixtures/specter/snapshots/acme.json",
  "bec-acme": "fixtures/specter/snapshots/acme.json",
};

// ---------------------------------------------------------------------
// HTTP layer — SPECTER_FLOW.md §0 ("API basics").
// ---------------------------------------------------------------------

const LIVE_BASE = process.env.SPECTER_API_BASE || "https://app.tryspecter.com/api/v1";
const API_KEY = process.env.SPECTER_API_KEY ?? "";

function isOfflineMode(): boolean {
  if (isForceFixtures()) return true;
  return (process.env.OFFLINE_MODE ?? "").toLowerCase() === "true";
}

function isLiveAvailable(): boolean {
  return Boolean(API_KEY) && !isOfflineMode();
}

class SpecterError extends Error {
  status: number;
  code: "NOT_FOUND" | "NOT_PERMITTED" | "VALIDATION_ERROR" | "WRONG_PATH" | "RATE_LIMIT" | "OTHER";
  constructor(status: number, code: SpecterError["code"], message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

async function specterFetch<T>(
  path: string,
  init: { method: "GET" | "POST"; body?: unknown } = { method: "GET" },
): Promise<T> {
  if (!isLiveAvailable()) {
    throw new SpecterError(0, "OTHER", "specter:no-key-or-offline");
  }
  const url = `${LIVE_BASE}${path}`;
  const headers: Record<string, string> = {
    // §0: header `X-API-Key: <key>`.
    "X-API-Key": API_KEY,
    Accept: "application/json",
  };
  if (init.body !== undefined) headers["Content-Type"] = "application/json";

  const res = await fetch(url, {
    method: init.method,
    headers,
    body: init.body ? JSON.stringify(init.body) : undefined,
  });

  // §0 rate-limit hint: respect remaining when ≤ 1.
  const remaining = Number(res.headers.get("x-ratelimit-remaining") ?? "");
  const resetMs = Number(res.headers.get("x-ratelimit-reset") ?? "0");
  if (Number.isFinite(remaining) && remaining <= 1 && resetMs > 0) {
    const waitMs = Math.min(Math.max(resetMs - Date.now(), 250), 2000);
    await new Promise((r) => setTimeout(r, waitMs));
  }

  if (res.status === 200) {
    return (await res.json()) as T;
  }

  // §0 error semantics. We need to distinguish JSON-404 (record/credit) vs HTML-404 (wrong path).
  const contentType = res.headers.get("content-type") ?? "";
  const text = await res.text();

  if (res.status === 404) {
    if (contentType.includes("text/html") || text.startsWith("<!DOCTYPE")) {
      throw new SpecterError(404, "WRONG_PATH", `specter:wrong-path ${path}`);
    }
    throw new SpecterError(404, "NOT_FOUND", `specter:not-found ${path}`);
  }
  if (res.status === 403) {
    throw new SpecterError(403, "NOT_PERMITTED", `specter:not-permitted ${path}`);
  }
  if (res.status === 400) {
    throw new SpecterError(400, "VALIDATION_ERROR", `specter:validation ${path} :: ${text.slice(0, 200)}`);
  }
  if (res.status === 429) {
    throw new SpecterError(429, "RATE_LIMIT", `specter:rate-limit ${path}`);
  }
  throw new SpecterError(res.status, "OTHER", `specter:${res.status} ${path}`);
}

// ---------------------------------------------------------------------
// Endpoint wrappers — §1–§7.
// Shapes are deliberately permissive (`unknown`-returning) at the HTTP
// boundary; the snapshot builder is the only consumer and validates the
// fields it actually reads.
// ---------------------------------------------------------------------

interface RawCompany {
  id: string;
  organization_name: string;
  website?: { domain?: string; domain_aliases?: string[] };
  hq?: { city?: string; state?: string; country?: string };
  founded_year?: number;
  employee_count?: number;
  employee_count_range?: string;
  growth_stage?: string;
  operating_status?: string;
  tech_verticals?: [string, string][];
  industries?: string[];
  tagline?: string;
  description?: string;
  funding?: {
    total_funding_usd?: number;
    last_funding_type?: string;
    last_funding_usd?: number;
    last_funding_date?: string;
    round_count?: number;
    round_details?: unknown[];
  };
  investors?: string[];
  founder_info?: Array<{ person_id: string; full_name: string }>;
  highlights?: string[];
  new_highlights?: string[];
  traction_metrics?: {
    web_visits?: { latest?: number };
    employee_count?: { latest?: number; "6mo_change"?: number };
    linkedin_followers?: { latest?: number };
  };
  socials?: {
    linkedin?: { url?: string };
    twitter?: { url?: string };
    crunchbase?: { url?: string };
  };
}

interface RawPersonRow {
  person_id: string;
  full_name: string;
  title?: string;
  is_founder?: boolean;
}

interface RawPerson {
  person_id: string;
  full_name: string;
  tagline?: string;
  linkedin_url?: string;
  twitter_url?: string;
  github_url?: string;
  location?: string;
  years_of_experience?: number;
  level_of_seniority?: string;
  education_level?: string;
  highlights?: string[];
  experience?: Array<{
    company_id?: string;
    company_name?: string;
    title?: string;
    description?: string;
    is_current?: boolean;
    end_date?: string;
  }>;
  education?: Array<{ school?: string; degree?: string }>;
  talent_signal_ids?: string[] | null;
  investor_signal_ids?: string[] | null;
}

async function postCompaniesByUrl(websiteUrl: string): Promise<RawCompany[]> {
  // §1 — POST /companies { website_url }.
  return specterFetch<RawCompany[]>("/companies", {
    method: "POST",
    body: { website_url: websiteUrl },
  });
}

async function getCompanyById(specterId: string): Promise<RawCompany> {
  return specterFetch<RawCompany>(`/companies/${specterId}`, { method: "GET" });
}

async function getCompanyPeople(specterId: string): Promise<RawPersonRow[]> {
  // §2 — GET /companies/{id}/people.
  return specterFetch<RawPersonRow[]>(`/companies/${specterId}/people`, { method: "GET" });
}

async function getPerson(personId: string): Promise<RawPerson> {
  // §3 — GET /people/{id}.
  return specterFetch<RawPerson>(`/people/${personId}`, { method: "GET" });
}

async function getSimilar(specterId: string): Promise<string[]> {
  // §5 — GET /companies/{id}/similar. Returns flat array of ids.
  const ids = await specterFetch<unknown>(`/companies/${specterId}/similar`, { method: "GET" });
  if (!Array.isArray(ids)) return [];
  return ids
    .map((row) => (typeof row === "string" ? row : (row as { id?: string }).id))
    .filter((x): x is string => typeof x === "string");
}

// ---------------------------------------------------------------------
// Snapshot builder — orchestrates §1–§5 + §4 cross-step flags.
// ---------------------------------------------------------------------

const PRIOR_EXIT_RE = /\b(acquired|acq\.|IPO|TSX:|NASDAQ:|NYSE:)/i;

function projectCompany(raw: RawCompany): SpecterCompanyBlock {
  return {
    specter_id: raw.id,
    legal_name: raw.organization_name,
    domain: raw.website?.domain ?? "",
    hq_city: raw.hq?.city ?? "",
    hq_country: raw.hq?.country ?? "",
    founded_year: raw.founded_year ?? 0,
    employee_count: raw.employee_count ?? 0,
    growth_stage: raw.growth_stage ?? "",
    operating_status: raw.operating_status ?? "",
    tech_verticals: raw.tech_verticals ?? [],
    industries: raw.industries ?? [],
    tagline: raw.tagline ?? "",
    description: raw.description ?? "",
    funding: {
      total_usd: raw.funding?.total_funding_usd ?? 0,
      last_type: raw.funding?.last_funding_type ?? "",
      last_usd: raw.funding?.last_funding_usd ?? 0,
      last_date: raw.funding?.last_funding_date ?? "",
      investors: raw.investors ?? [],
      round_count: raw.funding?.round_count ?? 0,
    },
    highlights: raw.highlights ?? [],
    new_highlights: raw.new_highlights ?? [],
    traction: {
      web_visits_latest: raw.traction_metrics?.web_visits?.latest ?? 0,
      headcount_6mo_change: raw.traction_metrics?.employee_count?.["6mo_change"] ?? 0,
      linkedin_followers_latest: raw.traction_metrics?.linkedin_followers?.latest ?? 0,
    },
  };
}

function projectFounder(
  raw: RawPerson,
  subjectCompanyId: string,
  subjectLastFundingDate: string,
): SpecterFounderBlock {
  const exp = raw.experience ?? [];
  const currentRow = exp.find((e) => e.is_current === true);
  const subjectRow = exp.find((e) => e.company_id === subjectCompanyId);

  // §3b — prior_exits.
  const prior_exits = exp.filter(
    (e) => e.description && PRIOR_EXIT_RE.test(e.description),
  ).length;

  // §3b — stealth_history.
  const stealth_history = exp.some(
    (e) => typeof e.company_name === "string" && /^stealth$/i.test(e.company_name),
  );

  // §3b / §4a — founder departed deal subject before close.
  let departed_subject_company: SpecterFounderBlock["departed_subject_company"] = null;
  if (subjectRow && subjectRow.is_current === false && subjectRow.end_date) {
    const close = subjectLastFundingDate ? Date.parse(subjectLastFundingDate) : NaN;
    const out = Date.parse(subjectRow.end_date);
    if (Number.isFinite(close) && Number.isFinite(out) && close > out) {
      const days_before_close = Math.round((close - out) / 86_400_000);
      departed_subject_company = { end_date: subjectRow.end_date, days_before_close };
    }
  }

  // Notable prior employers — for the Desk 02 headline we surface the
  // 3 most recent non-current employers.
  const notable_prior_employers = exp
    .filter((e) => !e.is_current && typeof e.company_name === "string" && e.company_name)
    .slice(0, 3)
    .map((e) => e.company_name as string);

  const eduTop = (raw.education ?? [])[0];

  return {
    person_id: raw.person_id,
    full_name: raw.full_name,
    tagline: raw.tagline ?? "",
    linkedin_url: raw.linkedin_url ?? "",
    location: raw.location ?? "",
    years_of_experience: raw.years_of_experience ?? 0,
    highlights: raw.highlights ?? [],
    education_top: eduTop?.school
      ? { school: eduTop.school, degree: eduTop.degree ?? "" }
      : null,
    current_role: {
      title: currentRow?.title ?? "",
      company_name: currentRow?.company_name ?? null,
      is_current: Boolean(currentRow?.is_current),
    },
    prior_exits,
    stealth_history,
    departed_subject_company,
    talent_signal_ids: raw.talent_signal_ids ?? null,
    investor_signal_ids: raw.investor_signal_ids ?? null,
    notable_prior_employers,
  };
}

function median(xs: number[]): number | null {
  if (xs.length === 0) return null;
  const s = xs.slice().sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 0 ? (s[mid - 1] + s[mid]) / 2 : s[mid];
}

function mean(xs: number[]): number | null {
  if (xs.length === 0) return null;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

async function buildPeers(
  subject: SpecterCompanyBlock,
): Promise<SpecterPeersBlock> {
  // §5 — fetch up to 10 ids, fan out company lookups in parallel.
  let peerIds: string[] = [];
  try {
    peerIds = await getSimilar(subject.specter_id);
  } catch {
    peerIds = [];
  }
  const settled = await Promise.allSettled(peerIds.map((id) => getCompanyById(id)));
  const peers = settled
    .map((r) => (r.status === "fulfilled" ? r.value : null))
    .filter((v): v is RawCompany => Boolean(v));

  const seedOnly = peers.filter(
    (p) => (p.growth_stage ?? "") === subject.growth_stage,
  );
  const seedAmounts = seedOnly
    .map((p) => p.funding?.last_funding_usd ?? 0)
    .filter((n) => n > 0);

  const subjectVerticals = new Set(
    subject.tech_verticals.map((v) => v.join("/")),
  );
  const direct = peers
    .filter((p) =>
      (p.tech_verticals ?? []).some((v) => subjectVerticals.has(v.join("/"))),
    )
    .map((p) => ({
      specter_id: p.id,
      name: p.organization_name,
      last_funding_usd: p.funding?.last_funding_usd ?? 0,
      last_funding_type: p.funding?.last_funding_type ?? "",
      last_funding_date: p.funding?.last_funding_date ?? "",
      investors: p.investors ?? [],
    }));

  const range = seedAmounts.length > 0
    ? ([Math.min(...seedAmounts), Math.max(...seedAmounts)] as [number, number])
    : null;

  return {
    n_total: peers.length,
    seed_median_usd: median(seedAmounts),
    seed_mean_usd: mean(seedAmounts),
    range_usd: range,
    direct_matches: direct,
    caveat: "similar endpoint returns broad seed-AI pool; treat as soft peers",
  };
}

function computeCrossFlags(
  company: SpecterCompanyBlock,
  founders: SpecterFounderBlock[],
  peers: SpecterPeersBlock,
): SpecterFlag[] {
  const flags: SpecterFlag[] = [];

  // §4a — founder_departed_before_close.
  for (const f of founders) {
    const d = f.departed_subject_company;
    if (!d) continue;
    const sev: SpecterFlag["severity"] = d.days_before_close <= 30 ? "block" : "review";
    flags.push({
      code: "founder_departed_before_close",
      severity: sev,
      detail: `${f.full_name} (${f.current_role.title || "former role"}) left ${d.end_date}, ${d.days_before_close} days before ${company.funding.last_type} close`,
      citations: [f.person_id, company.specter_id],
    });

    // §4b — ex_founder_now_at_investor.
    const investors = company.funding.investors.map((i) => i.toLowerCase());
    const tagline = (f.tagline ?? "").toLowerCase();
    const hit = investors.find((inv) => inv && tagline.includes(inv));
    if (hit) {
      flags.push({
        code: "ex_founder_now_at_investor",
        severity: "review",
        detail: `${f.full_name}'s current tagline references "${hit}", which is a listed investor in the closing round`,
        citations: [f.person_id],
      });
    }
  }

  // §4c — funding_outlier_high / _low.
  const median = peers.seed_median_usd;
  if (median && median > 0 && company.funding.last_usd > 0) {
    const ratio = company.funding.last_usd / median;
    if (ratio > 5) {
      flags.push({
        code: "funding_outlier_high",
        severity: "review",
        detail: `Round ${(company.funding.last_usd / 1e6).toFixed(1)}M is ${ratio.toFixed(1)}× peer seed median (${(median / 1e6).toFixed(1)}M)`,
        citations: [company.specter_id],
      });
    } else if (ratio < 0.3) {
      flags.push({
        code: "funding_outlier_low",
        severity: "review",
        detail: `Round ${(company.funding.last_usd / 1e6).toFixed(1)}M is ${ratio.toFixed(1)}× peer seed median (${(median / 1e6).toFixed(1)}M)`,
        citations: [company.specter_id],
      });
    }
  }

  // Web-traffic dip during headcount surge — informational yellow flag.
  if (
    company.highlights.includes("web_traffic_3mo_dip") &&
    company.highlights.includes("headcount_3mo_surge")
  ) {
    flags.push({
      code: "web_traffic_dip_during_growth",
      severity: "info",
      detail:
        "web_traffic_3mo_dip flag set despite headcount_3mo_surge — investigate product traction",
      citations: [company.specter_id],
    });
  }

  return flags;
}

async function buildLiveSnapshot(req: SnapshotRequest): Promise<SpecterSnapshot> {
  // §1 — resolve the company.
  let raw: RawCompany;
  if (req.specterId) {
    raw = await getCompanyById(req.specterId);
  } else if (req.websiteUrl) {
    const arr = await postCompaniesByUrl(req.websiteUrl);
    if (!Array.isArray(arr) || arr.length === 0) {
      throw new SpecterError(404, "NOT_FOUND", `specter:no-company-for ${req.websiteUrl}`);
    }
    raw = arr[0];
  } else {
    throw new SpecterError(400, "VALIDATION_ERROR", "buildLiveSnapshot: need websiteUrl or specterId");
  }
  const company = projectCompany(raw);

  // §2 — resolve the team. Merge founder_info + people[is_founder == true].
  const peopleRows = await getCompanyPeople(company.specter_id).catch((err) => {
    if (err instanceof SpecterError && err.code === "NOT_PERMITTED") return [] as RawPersonRow[];
    throw err;
  });
  const founderIds = new Map<string, string>();
  for (const fi of raw.founder_info ?? []) {
    if (fi.person_id) founderIds.set(fi.person_id, fi.full_name);
  }
  for (const p of peopleRows) {
    if (p.is_founder && p.person_id) founderIds.set(p.person_id, p.full_name);
  }

  // §3 — enrich each founder in parallel.
  const personSettled = await Promise.allSettled(
    Array.from(founderIds.keys()).map((id) => getPerson(id)),
  );
  const founders: SpecterFounderBlock[] = personSettled
    .map((r) => (r.status === "fulfilled" ? r.value : null))
    .filter((p): p is RawPerson => Boolean(p))
    .map((p) => projectFounder(p, company.specter_id, company.funding.last_date));

  // §5 — peers.
  const peers = await buildPeers(company);

  // §4 — cross-step flags.
  const flags = computeCrossFlags(company, founders, peers);

  return {
    fetched_at: new Date().toISOString(),
    company,
    founders,
    peers,
    flags,
  };
}

// ---------------------------------------------------------------------
// Public entrypoints.
// ---------------------------------------------------------------------

const snapshotCache = new Map<string, SpecterSnapshot>();

export async function buildSpecterSnapshot(
  req: SnapshotRequest,
): Promise<{ snapshot: SpecterSnapshot; cached: boolean; mode: "live" | "fixture" }> {
  const cacheKey = req.specterId ?? req.websiteUrl ?? req.seed ?? "default";
  const hit = snapshotCache.get(cacheKey);
  if (hit) return { snapshot: hit, cached: true, mode: "fixture" };

  if (isLiveAvailable() && (req.websiteUrl || req.specterId)) {
    try {
      const snapshot = await buildLiveSnapshot(req);
      snapshotCache.set(cacheKey, snapshot);
      return { snapshot, cached: false, mode: "live" };
    } catch (err) {
      // Fall through to fixture fallback.
      if (process.env.NODE_ENV !== "production") {
        console.warn("[specter] live snapshot failed, falling back:", String(err));
      }
    }
  }

  const seed: SnapshotSeed = req.seed ?? defaultSeedForUrl(req.websiteUrl);
  const snapshot = await loadFixture<SpecterSnapshot>(SNAPSHOT_FIXTURE[seed]);
  snapshotCache.set(cacheKey, snapshot);
  return { snapshot, cached: true, mode: "fixture" };
}

function defaultSeedForUrl(url?: string): SnapshotSeed {
  if (!url) return "dex-meetdex";
  if (/meetdex|dex/i.test(url)) return "dex-meetdex";
  if (/acme/i.test(url)) return "clean-acme";
  return "dex-meetdex";
}

export function clearSpecterCache(): void {
  snapshotCache.clear();
}

export { SpecterError };
