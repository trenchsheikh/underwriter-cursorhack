# Specter Agent Flow — Company Diligence Pull

This document is the spec for the backend diligence agent's interaction with
the Specter API. It is written for an LLM-driven agent: read top-to-bottom,
follow the steps in order, and produce the output object at the bottom.

The flow takes a company URL or domain (the deal subject) and returns a
structured `SpecterSnapshot` consumed by the desks (`Company`, `Founder`,
`Lead Investor`, `Round Dynamics`). Every fact in the snapshot is API-derived;
no fabricated fields.

The worked example below uses **Dex (`meetdex.ai`)** — a London-based AI
talent platform that closed a $5.3M Seed on 2026-04-27 led by a16z. It is the
canonical fixture for this flow.

---

## 0. API basics

- **Base URL:** `https://app.tryspecter.com/api/v1`
- **Auth:** header `X-API-Key: <key>`. Key lives in `SPECTER_API_KEY`.
- **Rate limit:** observed `x-ratelimit-limit: 6` per window. Respect
  `x-ratelimit-remaining` / `x-ratelimit-reset` headers; back off when
  remaining ≤ 1.
- **Cost:** most endpoints consume 1 credit per request. Cache aggressively
  per `specter_id` for the lifetime of a diligence run.
- **Error semantics:**
  - `200` with JSON body — success.
  - `404 NOT_FOUND` (clean JSON) — id is real but record does not exist
    *or* credit limit exceeded. Distinguish via `x-ratelimit-remaining`.
  - `404` with HTML body (`<!DOCTYPE html>...Specter - Error`) — wrong path.
    The agent has constructed a URL that is not in the API. Stop and fix.
  - `403 NOT_PERMITTED` — feature not available on this key. Skip the step.
  - `400 VALIDATION_ERROR` — malformed input. Re-read the request schema.

If a step fails non-fatally, set the corresponding snapshot field to `null`
and continue. The desks degrade gracefully.

---

## 1. Resolve the company

**Endpoint:** `POST /companies` with `{ "website_url": "<url>" }`
(or `{ "domain": "..." }` / `{ "linkedin_url": "..." }`).

This call enriches and returns the full company record. It is the only
endpoint that accepts a URL/domain — every other endpoint requires the
returned `id`.

**Worked call:**
```bash
curl -sX POST https://app.tryspecter.com/api/v1/companies \
  -H "X-API-Key: $SPECTER_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"website_url": "https://meetdex.ai/"}'
```

**Extract into snapshot.company:**
| Snapshot field | Source path |
|---|---|
| `specter_id` | `[0].id` |
| `legal_name` | `[0].organization_name` |
| `domain` | `[0].website.domain` (alias list at `website.domain_aliases`) |
| `hq_city` / `hq_state` / `hq_country` | `[0].hq.{city,state,country}` |
| `founded_year` | `[0].founded_year` |
| `employee_count` | `[0].employee_count` |
| `employee_count_range` | `[0].employee_count_range` |
| `growth_stage` | `[0].growth_stage` (`seed_stage` / `early_stage` / ...) |
| `operating_status` | `[0].operating_status` (`active` / `closed` / ...) |
| `tech_verticals` | `[0].tech_verticals` (array of `[domain, sub-domain]` pairs) |
| `industries` | `[0].industries` |
| `tagline` | `[0].tagline` |
| `description` | `[0].description` |
| `funding.total_usd` | `[0].funding.total_funding_usd` |
| `funding.last_type` | `[0].funding.last_funding_type` |
| `funding.last_usd` | `[0].funding.last_funding_usd` |
| `funding.last_date` | `[0].funding.last_funding_date` |
| `funding.investors` | `[0].investors` (flat array, no roles attached) |
| `funding.round_count` | `[0].funding.round_count` |
| `funding.round_details` | `[0].funding.round_details` (often `[]` — no per-round lead) |
| `highlights` | `[0].highlights` (array of strings — see §1a) |
| `new_highlights` | `[0].new_highlights` (recently-flipped subset) |
| `traction.web_visits` | `[0].traction_metrics.web_visits` (latest + 1mo/3mo/6mo) |
| `traction.headcount` | `[0].traction_metrics.employee_count` (same shape) |
| `traction.linkedin_followers` | `[0].traction_metrics.linkedin_followers` |
| `socials.linkedin_url` | `[0].socials.linkedin.url` |
| `socials.twitter_url` | `[0].socials.twitter.url` |
| `socials.crunchbase_url` | `[0].socials.crunchbase.url` |

### 1a. Highlight strings to flag on

`highlights` is a string array of pre-computed Specter flags. The agent maps
these into structured booleans:

| Highlight string | Underwriter meaning |
|---|---|
| `top_tier_investors` | Round includes a tier-1 firm in Specter's dictionary |
| `recent_funding` | Last round closed within the last ~6 months |
| `raised_last_month` | Last round closed in the last 30 days |
| `no_recent_funding` | Last round older than ~12 months |
| `headcount_3mo_surge` | FTE growth 3mo > 50% (or large-step threshold) |
| `headcount_6mo_momentum` | Sustained FTE growth across 6mo |
| `headcount_12mo_scale_up` | 12mo FTE scale-up |
| `web_traffic_3mo_surge` | Web traffic up 3mo |
| `web_traffic_3mo_dip` | Web traffic down 3mo (yellow flag) |
| `social_followers_3mo_surge` | LinkedIn/Twitter follower surge 3mo |
| `social_followers_6mo_momentum` | Sustained social growth 6mo |
| `media_spotlight` | Recent press coverage detected |
| `recent_news` | Recent news activity |

Treat any flag prefixed `*_dip` as a yellow signal. Treat `no_recent_funding`
as a yellow signal when the deal subject is mid-fundraise.

---

## 2. Resolve the team

**Endpoint:** `GET /companies/{specter_id}/people`

Returns the public-facing roster. Fields per row: `person_id`, `full_name`,
`title`, `is_founder`, `departments`, `seniority`.

**Critical caveat:** this list does not always include every founder. Some
founders appear only in `company.founder_info` from step 1. Always merge:

```
founders = unique_by_person_id(
  company.founder_info[]
  + people[] where is_founder == true
)
```

For Dex this matters: `/people` returns 14 rows but only Paddy Lambros has
`is_founder: true`. Harry Uglow appears only in `company.founder_info`.

For each founder in the merged set, run step 3.

---

## 3. Enrich each founder

**Endpoint:** `GET /people/{person_id}`

Returns the full person profile.

**Extract into snapshot.founders[]:**
| Snapshot field | Source path |
|---|---|
| `person_id` | `person_id` |
| `full_name` | `full_name` |
| `tagline` | `tagline` |
| `linkedin_url` | `linkedin_url` |
| `twitter_url` | `twitter_url` |
| `github_url` | `github_url` |
| `location` | `location` |
| `years_of_experience` | `years_of_experience` |
| `level_of_seniority` | `level_of_seniority` |
| `education_level` | `education_level` |
| `highlights` | `highlights` (see §3a) |
| `experience` | `experience[]` — pass through; downstream uses `description` |
| `education` | `education[]` |
| `talent_signal_ids` | `talent_signal_ids` (UUIDs, may be `null`) |
| `investor_signal_ids` | `investor_signal_ids` (UUIDs, may be `null`) |
| `current_role` | first `experience[]` row where `is_current == true` |
| `current_company_id` | same row's `company_id` |

### 3a. Founder highlight strings

| Highlight | Meaning |
|---|---|
| `serial_founder` | Founded ≥2 companies |
| `vc_backed_founder` | Currently leads a VC-backed company |
| `prior_vc_backed_founder` | Previously founded a VC-backed company |
| `prior_vc_backed_experience` | Worked at a VC-backed company before founding |
| `top_university` | Attended a tier-1 university (Specter's dictionary) |
| `major_tech_experience` | Worked at FAANG-tier company |
| `fortune_500_experience` | Worked at a F500 |
| `hyper_connector` | Specter-computed network signal — strong recruiter/operator signal |

### 3b. Derived fields the agent must compute

These fields are NOT in the API response. The agent computes them from
the raw experience array.

**`prior_exits` (count of acquired/IPO'd prior companies)** — regex
`description` field of each `experience[]` entry for `acquired|acq\.|IPO|TSX:`.
Brandon Wang's Conduit Analytics row has `description: "Acquired in 2019..."`
which is the only place that fact lives. Specter does not return a structured
`outcome` per role.

**`stealth_history` (boolean)** — `true` if any `experience[].company_name`
matches `^Stealth$` (case-insensitive). Brandon's current row literally is.

**`departed_subject_company` (boolean + date)** — for the founder of the
deal subject company, look up the `experience[]` row where
`company_id == snapshot.company.specter_id`. If `is_current == false`, the
founder has departed. Capture `end_date` and the gap to `funding.last_date`
(see §4 flag).

---

## 4. Cross-step underwriting flags

After steps 1–3 complete, compute these flags before emitting the snapshot.

### 4a. Founder-departed-pre-close

```
for founder in snapshot.founders:
  row = first experience where company_id == company.specter_id
  if row and row.is_current == false:
    days_to_close = funding.last_date - row.end_date
    if days_to_close <= 90 and funding.last_date > row.end_date:
      flag: founder_departed_before_close
      severity: review (90d) or block (30d)
      detail: "{name} ({title}) left {end_date}, {days_to_close} days before {last_funding_type} close"
```

This is the Dex-vs-Harry case. Treat as a Desk 02 `REVIEW` flag at minimum.

### 4b. Investor-overlap

```
for founder in snapshot.founders:
  if departed and current_role mentions any name in funding.investors[]:
    flag: ex_founder_now_at_investor
    severity: review
```

Harry Uglow's tagline contains "a16z speedrun scout" and `a16z speedrun` is in
Dex's `investors[]`. This compounds 4a — the departing CTO went to an
investor in the round he left.

### 4c. Seed-amount-vs-peers

Run step 5 to fetch peers. Then:
```
median = median(peer.funding.last_funding_usd where growth_stage == subject.growth_stage)
ratio = subject.funding.last_usd / median
if ratio > 5: flag funding_outlier_high
if ratio < 0.3: flag funding_outlier_low
```

---

## 5. Pull peer comparables

**Endpoint:** `GET /companies/{specter_id}/similar`

Returns a flat array of up to 10 company IDs. **Caveat:** this endpoint may
return a default seed-stage AI peer pool that is not strongly tailored to the
subject — the same 10 IDs were observed for both AIUC and Dex. Treat the
output as "broad seed-stage AI peers", not "true semantic comparables."

For each returned id, call `GET /companies/{id}` (cheaper than re-enriching)
and extract `funding.last_funding_*`, `growth_stage`, `tech_verticals`,
`employee_count`, `investors`. Compute:
```
peers.n_total
peers.seed_only.{n, median_usd, mean_usd, min_usd, max_usd}
peers.matching_verticals[]   # peers sharing ≥1 tech_vertical with subject
```

Run all 10 fetches in parallel; budget ~3–4s wall-time.

---

## 6. Talent signals (optional, per founder)

**Endpoint:** `GET /talent/{talent_signal_id}` — `talent_signal_id` is one of
the UUIDs from step 3's `talent_signal_ids` array. **Not** the `per_xxx`
person id.

Returns a signal record:
```
{
  signal_score: 1-10,
  signal_summary: "Free-text summary of why this person is a tracked signal",
  signal_type: "New Company" | ...,
  signal_date: "YYYY-MM-DD",
  ...person profile fields merged in
}
```

Only fetch the most recent 1–2 signals per founder. They are demo-grade
narrative material for Desk 02, not load-bearing for the verdict.

---

## 7. Investor interest signals (NOT WIRED)

**Endpoint:** `GET /investor-interest/{signal_id}` (singular path).

The endpoint exists and is documented. The schema is:
```
{
  signal_id, signal_date, signal_score (1-10), signal_summary,
  signal_type: "Company" | "Talent",
  source_types: insider | journalist | influencer | angel
              | venture_capital | private_equity | investment_bank,
  signal_investors: [{ name }],
  signal_total_funding_usd, signal_last_funding_usd, signal_last_funding_date,
  entity_id, company: {...} | person: {...}
}
```

**However:** signal IDs reachable from the current API key are
exhausted. The `investor_signal_ids` field on a person profile is sparse and
the IDs we have observed (Brandon Wang's two) return clean `404 NOT_FOUND`.
The correct ingestion path requires a saved Investor Interest search created
via the Specter web UI, then:

```
GET /searches                                         # find query_id
GET /investor-interest-searches/{query_id}/results    # paginated signal_ids
GET /investor-interest/{signal_id}                    # per-signal detail
```

Until the saved search exists, **the agent does not call this endpoint** and
Desk 03 falls back to the `funding.investors[]` + `top_tier_investors` /
`raised_last_month` highlight-driven tile.

---

## 8. Output: SpecterSnapshot

The agent emits this object. The desks consume it; nothing else.

```ts
type SpecterSnapshot = {
  fetched_at: string;             // ISO 8601
  company: {
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
  };
  founders: Array<{
    person_id: string;
    full_name: string;
    tagline: string;
    linkedin_url: string;
    location: string;
    years_of_experience: number;
    highlights: string[];
    education_top: { school: string; degree: string } | null;
    current_role: { title: string; company_name: string; is_current: boolean };
    prior_exits: number;          // computed §3b
    stealth_history: boolean;     // computed §3b
    departed_subject_company: { end_date: string; days_before_close: number } | null;
    talent_signal_ids: string[] | null;
    investor_signal_ids: string[] | null;
    notable_prior_employers: string[];   // composed for Desk 02 headline
  }>;
  peers: {
    n_total: number;
    seed_median_usd: number | null;
    seed_mean_usd: number | null;
    range_usd: [number, number] | null;
    direct_matches: Array<{       // peers sharing ≥1 tech_vertical
      specter_id: string;
      name: string;
      last_funding_usd: number;
      last_funding_type: string;
      last_funding_date: string;
      investors: string[];
    }>;
    caveat: "similar endpoint returns broad seed-AI pool; treat as soft peers";
  };
  flags: Array<{
    code: string;                 // e.g. "founder_departed_before_close"
    severity: "info" | "review" | "block";
    detail: string;
    citations: string[];          // specter_id, person_id, etc.
  }>;
};
```

---

## Worked example: Dex (`meetdex.ai`)

Running the flow against `https://meetdex.ai/` on 2026-04-30 produces the
snapshot below. This is the canonical fixture for the agent.

```yaml
company:
  specter_id:        682dae1369dc2657a5e56c33
  legal_name:        Dex
  domain:            meetdex.ai
  hq:                London, United Kingdom
  founded_year:      2025
  employee_count:    28
  growth_stage:      seed_stage
  operating_status:  active
  tech_verticals:
    - [Future of Work, Talent Acquisition and Employer Branding]
    - [Commerce & Marketplaces, B2B Marketplaces & Procurement Networks]
    - [Enterprise Automation, AI Agents and Process Copilots]
  funding:
    total_usd:       8400000
    last_type:       Seed
    last_usd:        5300000
    last_date:       2026-04-27        # 3 days before run
    investors:
      - Andreessen Horowitz
      - a16z speedrun
      - Notion Capital
      - Concept Ventures
      - Bryce Keane
      - Charlie Songhurst
      - Eric French
      - Kamil Mieczakowski
      - Nilan Peiris
      - Stephen Whitworth
  highlights:
    - top_tier_investors
    - raised_last_month
    - recent_funding
    - headcount_3mo_surge
    - headcount_6mo_momentum
    - social_followers_3mo_surge
    - social_followers_6mo_momentum
    - web_traffic_3mo_dip       # yellow

founders:
  - person_id:        per_db6afacb7cd148865e09936c
    full_name:        Paddy Lambros
    tagline:          CEO & Co-Founder @ Dex, AI Talent Partner — Top 100 Talent Leader
    years_of_experience: 12
    highlights:
      - hyper_connector
      - major_tech_experience
      - prior_vc_backed_experience
      - vc_backed_founder
    education_top:    { school: University of the West of England, degree: BA Politics }
    current_role:     { title: CEO/Co-Founder, company_name: Dex, is_current: true }
    notable_prior_employers: [Atomico, Improbable, Sensat]
    prior_exits:      0
    stealth_history:  false
    departed_subject_company: null
    talent_signal_ids: ["f2e2b16c-dd24-418d-ac83-2e28a4434366"]
    investor_signal_ids: null

  - person_id:        per_285642ef6e02ed9f2c1544ec
    full_name:        Harry Uglow
    tagline:          Building something new | Co-founder & former CTO of Dex | a16z speedrun scout
    years_of_experience: 8
    highlights:
      - prior_vc_backed_founder
      - top_university
    education_top:    { school: Imperial College London, degree: MEng Computing (AI) }
    current_role:     { title: (none — building something new), company_name: null, is_current: false }
    notable_prior_employers: [Atomico, Kinscape, Ava Security]
    prior_exits:      0
    stealth_history:  false
    departed_subject_company:
      end_date:           2026-04-01
      days_before_close:  26
    talent_signal_ids:
      - 0adf6f06-89c6-43d4-b0bd-08ab7db7b411
      - eef09a8d-133b-4d41-8488-97f5bba6b73e
    investor_signal_ids: null

peers:
  n_total: 10
  seed_only:
    n:           7
    median_usd:  6000000
    mean_usd:    14400000
    range_usd:   [4500000, 50000000]
  direct_matches:
    - { name: AgentMail,  last_funding_usd: 6000000,  last_funding_type: Seed,
        investors: [Y Combinator, General Catalyst, Paul Graham, Dharmesh Shah] }
    - { name: Coverflow,  last_funding_usd: 4800000,  last_funding_type: Seed,
        investors: [AIX Ventures, Afore Capital, Founder Collective] }
  caveat: similar endpoint returns broad seed-AI pool

flags:
  - code:     founder_departed_before_close
    severity: review
    detail:   Harry Uglow (Cofounder & CTO) left 2026-04-01, 26 days before Seed close 2026-04-27
    citations: [per_285642ef6e02ed9f2c1544ec, 682dae1369dc2657a5e56c33]
  - code:     ex_founder_now_at_investor
    severity: review
    detail:   Harry Uglow's current tagline references "a16z speedrun scout"; a16z and a16z speedrun are listed investors in the closing round
    citations: [per_285642ef6e02ed9f2c1544ec]
  - code:     web_traffic_dip_during_growth
    severity: info
    detail:   web_traffic_3mo_dip flag set despite headcount_3mo_surge — investigate product traction
    citations: [682dae1369dc2657a5e56c33]
```

These three flags drive Desk 02 to `REVIEW` and add a banner to the memo.
The verdict can still be `proceed` — the data does not block the deal — but
the AI underwriter has surfaced what a human reader might miss.

---

## Implementation notes for the backend agent

- Run steps 1, 2, 5 sequentially (each depends on `specter_id`). Run step 3
  per-founder in parallel. Run step 5's per-peer fetches in parallel.
  Total wall-time budget: ~6 seconds for the full snapshot.
- Cache by `specter_id` for the lifetime of a diligence run (`runId`). A
  re-run on the same company should not re-hit Specter unless explicitly
  requested.
- When `OFFLINE_MODE=true`, return the Dex fixture verbatim. Every desk in
  the demo must work without internet.
- Never invent fields. If a field is null in the response, propagate null.
  The desks distinguish between "Specter says no" and "Specter wasn't asked".
