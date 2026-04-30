# UnderWriter — Backend Specification

The complete backend brief: orchestration, six desks, data sources, the contract shared with the UI, fixtures, mock ledger, and the amendment PR flow. Read alongside `ARCHITECTURE.md` (the high-level design) and `DATA_SOURCES.md` (the API lookup).

> **Your job, backend agent:** Build a Next.js Route Handler that, given a deployment prompt and two attached files, fans out six concurrent desks against real data sources, streams findings back over SSE in the contract shape, synthesises a verdict, generates an IC memo, and proposes an amendment PR when the GP overrides. Twelve hours. Optimise for the demo first; correctness second; everything else third.

---

## 1. Folder structure

```
backend/
├── app/
│   └── api/
│       ├── run/route.ts             # POST — starts a run, streams SSE events
│       ├── memo/[runId]/route.ts    # GET — returns MemoData
│       └── amend/route.ts           # POST — opens amendment PR
├── agents/
│   ├── orchestrator.ts              # entrypoint; fans out 6 desks
│   ├── desks/
│   │   ├── company.ts
│   │   ├── founder.ts
│   │   ├── investor.ts
│   │   ├── round.ts
│   │   ├── mandate.ts
│   │   └── wire-safety.ts
│   ├── synthesise.ts                # findings → verdict
│   ├── memo.ts                      # findings + verdict → MemoData
│   └── amend.ts                     # override → AmendmentDraft + PR
├── lib/
│   ├── contract.ts                  # shared types (THE SEAM)
│   ├── mandate-loader.ts            # parses MANDATE.md frontmatter
│   ├── mandate-evaluator.ts         # pure rule evaluation
│   ├── ledger.ts                    # mock wire ledger
│   ├── cache.ts                     # in-memory + fixture fallback
│   └── sources/
│       ├── specter.ts
│       ├── companies-house.ts
│       ├── opensanctions.ts
│       ├── whois.ts
│       ├── pdf-parse.ts
│       └── llm.ts                   # OpenAI wrapper for structured output
├── fixtures/
│   ├── specter/
│   │   ├── acme-company.json
│   │   ├── acme-founders.json
│   │   ├── sequoia-interest.json
│   │   └── eu-robotics-rounds.json
│   ├── companies-house/
│   │   └── 13427891.json
│   ├── opensanctions/
│   │   └── acme-screen.json
│   ├── pdfs/
│   │   ├── acme_spa.pdf
│   │   ├── wire_instructions_clean.pdf
│   │   └── wire_instructions_bec.eml
│   └── fund-state.json
├── MANDATE.md                       # the policy file the loader parses
└── .env.local
```

---

## 2. The contract (shared with the UI)

This file is the seam between Person A (backend) and Person B (UI). Both sides import from it. **Changes require both halves of the team to agree.**

```ts
// lib/contract.ts

// ----- Domain ------------------------------------------------------

export type DeskId =
  | 'company' | 'founder' | 'investor' | 'round' | 'mandate' | 'wire';

export type DeskNumber = '01' | '02' | '03' | '04' | '05' | '06';

export type Status = 'idle' | 'streaming' | 'pass' | 'flag' | 'block';

export type SourceTag =
  | 'specter' | 'companies-house' | 'opensanctions'
  | 'whois' | 'mandate' | 'spa' | 'linkedin';

export interface Citation {
  source: SourceTag;
  ref: string;          // ID, URL fragment, or short reference
  url?: string;
  detail?: string;      // human-readable context
  cached?: boolean;     // if served from fixture, label so on the UI
}

export interface DeskFinding {
  desk: DeskId;
  number: DeskNumber;
  title: string;        // tile header label, e.g. "COMPANY DESK"
  status: Exclude<Status, 'idle' | 'streaming'>;
  confidence: number;   // 0..1
  durationMs: number;
  primary: string;      // tile headline finding (1 line)
  facts: string[];      // 2–4 supporting lines
  citations: Citation[];
  raw?: unknown;        // for the drawer's "show raw response" toggle
}

export interface Verdict {
  action: 'proceed' | 'review' | 'hold';
  confidence: number;          // joined confidence across desks
  summary: string;             // 1-line headline
  blockingDesk?: DeskId;
  blockingReason?: string;     // human-readable, used in the BLOCK modal
}

// ----- Run lifecycle ----------------------------------------------

export interface RunRequest {
  prompt: string;
  files: { name: string; mime: string; size: number; ref: string }[];
  // ref is either a fixture id ("clean-acme") or an uploaded blob id
  fixtureSeed?: 'clean-acme' | 'bec-acme';
}

export interface RunInit {
  runId: string;
  startedAt: string;            // ISO 8601
  mandateVersion: number;
  fundId: string;
}

// SSE events the backend streams to the UI ------------------------

export type RunEvent =
  | { type: 'run.init';      run: RunInit }
  | { type: 'desk.start';    desk: DeskId }
  | { type: 'desk.progress'; desk: DeskId; message: string }       // optional, for tile spinner text
  | { type: 'desk.citation'; desk: DeskId; citation: Citation }    // streamed as they arrive
  | { type: 'desk.resolved'; finding: DeskFinding }
  | { type: 'verdict';       verdict: Verdict }
  | { type: 'memo.ready';    memoId: string }
  | { type: 'error';         desk?: DeskId; message: string };

// ----- Memo --------------------------------------------------------

export interface MemoData {
  runId: string;
  fund: { name: string; id: string };
  deal: {
    company: string;
    round: string;            // e.g. "Series A"
    amountUsd: number;
    proRataPct?: number;
  };
  verdict: Verdict;
  findings: DeskFinding[];
  summary: string;            // editorial lede, 2–3 sentences
  recommendation: string;     // 1 sentence
  requiredActions: string[];  // ordered list
  generatedAt: string;
}

// ----- Amendment ---------------------------------------------------

export interface AmendmentDraft {
  runId: string;
  branch: string;             // e.g. "amend/lookalike-domain"
  diff: string;               // unified diff against MANDATE.md
  prTitle: string;
  prBody: string;             // includes rationale + run reference
  prUrl?: string;             // populated after PR is opened
}
```

The UI subscribes to `/api/run` via SSE and renders the events. **Order of events matters:** every `desk.resolved` for a given desk must be preceded by its `desk.start` and any number of `desk.citation` and `desk.progress` events. The `verdict` event arrives after all six `desk.resolved` events.

---

## 3. The orchestrator

Entrypoint at `app/api/run/route.ts`. Pseudocode:

```ts
import { NextRequest } from 'next/server';
import { runOrchestrator } from '@/agents/orchestrator';

export async function POST(req: NextRequest) {
  const body: RunRequest = await req.json();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: RunEvent) => {
        controller.enqueue(`data: ${JSON.stringify(event)}\n\n`);
      };
      try {
        await runOrchestrator(body, send);
      } catch (err) {
        send({ type: 'error', message: String(err) });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
    },
  });
}
```

In `agents/orchestrator.ts`:

```ts
export async function runOrchestrator(
  req: RunRequest,
  send: (event: RunEvent) => void
) {
  const runId = newId();
  const mandate = await loadMandate();       // parses MANDATE.md
  const deal   = await parsePrompt(req);     // LLM extracts deal shape

  send({
    type: 'run.init',
    run: {
      runId,
      startedAt: new Date().toISOString(),
      mandateVersion: mandate.version,
      fundId: mandate.fund.id,
    },
  });

  // Fire all six desks concurrently. Each desk emits its own events
  // through `send`. Promise.allSettled so one slow desk doesn't block.
  const findings = await Promise.allSettled([
    runCompanyDesk    (deal, mandate, send),
    runFounderDesk    (deal, mandate, send),
    runInvestorDesk   (deal, mandate, send),
    runRoundDesk      (deal, mandate, send),
    runMandateDesk    (deal, mandate, send),
    runWireSafetyDesk (deal, mandate, req.files, send),
  ]);

  const resolved = findings.flatMap(f =>
    f.status === 'fulfilled' ? [f.value] : []
  );

  const verdict = synthesise(resolved, mandate);
  send({ type: 'verdict', verdict });

  const memo = renderMemo(deal, mandate, resolved, verdict);
  await saveMemo(runId, memo);
  send({ type: 'memo.ready', memoId: runId });
}
```

Key decisions baked in:

- **Concurrent fan-out**, joined at the verdict step. No desk waits on any other.
- **`Promise.allSettled`**, not `Promise.all`. A single desk failure must not crash the run.
- **Each desk owns its own `send`** to emit `desk.start`, `desk.citation`, `desk.resolved` events as it works. This is what produces the staggered streaming the UI choreographs.
- **30-second hard timeout** per desk. Implementation: each desk runner wraps its core logic in `Promise.race([work, timeout(30_000)])` and returns a degraded `flag` finding on timeout.
- **No persistence beyond the run.** Memos are stored in an in-memory `Map<runId, MemoData>`. Restart loses them. Fine for the demo.

---

## 4. The six desks — detailed specs

Each desk is an async function:

```ts
type DeskRunner = (
  deal: ParsedDeal,
  mandate: Mandate,
  send: (event: RunEvent) => void,
  files?: ParsedFiles,
) => Promise<DeskFinding>;
```

The desk emits `desk.start`, then any number of `desk.citation` + `desk.progress`, then resolves with the `DeskFinding` (which the orchestrator turns into `desk.resolved`).

### 4.1 Company desk (`agents/desks/company.ts`)

**Job.** Verify the legal entity exists, is active, has a real footprint, and matches the prompt.

**Steps.**
1. `send({ type: 'desk.start', desk: 'company' })`.
2. Resolve company name → domain. If the prompt gave a name only, query Specter `text-search` to get the domain.
3. In parallel:
   - `getSpecterCompany(domain)` → enrichment data.
   - `searchCompaniesHouse(name)` → company number → `getCompaniesHouseProfile(number)`.
   - Stream `desk.citation` events as each source resolves.
4. Cross-check: incorporation year matches Specter's "founded" year ±1.
5. Compute confidence:
   - Both sources agree, status active, age > 1 year → 0.94+
   - One source missing → 0.70–0.85
   - Status dissolved/in liquidation → status `block`, confidence 0.99
   - Age < 30 days → status `block`, confidence 0.99
6. Resolve with `DeskFinding`.

**Block conditions.**
- Entity dissolved or in liquidation.
- Incorporated < 30 days ago **and** no Specter footprint.
- Name mismatch between Specter and registry beyond fuzzy match.

**Fixture path.** `fixtures/specter/acme-company.json` + `fixtures/companies-house/13427891.json`.

### 4.2 Founder desk (`agents/desks/founder.ts`)

**Job.** Confirm named founders exist, have the histories they claim, no disqualifying signals.

**Steps.**
1. `desk.start`.
2. Get team via `getSpecterCompanyPeople(companyId)`.
3. For each named founder in the prompt: enrich via `enrichSpecterPerson(name, company)`.
4. Run all founders + every named director through OpenSanctions PEP screen in parallel.
5. Stream citations as each resolves.
6. Confidence:
   - All founders found, prior funded experience, no PEP/sanctions → 0.90+
   - One founder thin-coverage → 0.70
   - Sanctions or PEP hit → status `block`, confidence 0.99

**Block conditions.**
- Sanctions or PEP match on any named founder.
- Pattern of dissolved companies in founder history (≥ 2 dissolved companies in last 3 years).

**Fixture path.** `fixtures/specter/acme-founders.json`.

### 4.3 Lead investor desk (`agents/desks/investor.ts`)

**Job.** Confirm the named lead is *actually* leading. The desk most dependent on Specter's unique data.

**Steps.**
1. `desk.start`.
2. `getSpecterInterestSignals(companyId, investorName)` filtered to last 60 days.
3. `getSpecterTransactions(sector, stage, geography, last12Months)` for comp count.
4. Stream citations: each interest signal as it arrives.
5. Confidence:
   - ≥ 3 partner engagements in last 60 days **and** named lead has ≥ 3 prior rounds in sector → 0.88+
   - 1–2 signals or stale → 0.60–0.75 → status `flag`
   - Zero signals → status `block`, confidence 0.95

**Block conditions.**
- Zero Specter Interest Signals between named lead and company in last 60 days, **and** named cheque size requires tier-1 lead per mandate.

**Fixture path.** `fixtures/specter/sequoia-interest.json` + `fixtures/specter/eu-robotics-rounds.json`.

### 4.4 Round dynamics desk (`agents/desks/round.ts`)

**Job.** Sanity-check round size, valuation, pro-rata math against comparables.

**Steps.**
1. `desk.start`.
2. Parse SPA via `parseSPA(file)` — uses GPT-5.5 structured output to extract `valuation_post_money`, `round_size`, `lead_investor`, `pro_rata_pct`, `liquidation_pref`.
3. `getSpecterTransactions(sector, stage, geography, last12Months)` for comparables.
4. Compute median + IQR for round size and post-money valuation.
5. Reconcile pro-rata math: `prompt.amountUsd = mandate's existing position × pro_rata_pct × claimedPct`.
6. Confidence:
   - Round in IQR, math reconciles → 0.85+
   - Round > 2σ off median → 0.60 → `flag`
   - Math doesn't reconcile → `flag`

**Block conditions.** None — this desk flags but doesn't block. Round dynamics are softer than wire safety.

**Fixture path.** Pre-parsed SPA in `fixtures/spa-parsed.json`.

### 4.5 Mandate desk (`agents/desks/mandate.ts`)

**Job.** Evaluate the deal against every rule in `MANDATE.md`. **Pure code, no LLM in the hot path.** Deterministic, auditable, fast.

**Steps.**
1. `desk.start`.
2. Load `mandate` (already loaded by orchestrator, passed in).
3. Load `fundState` from `fixtures/fund-state.json` (current portfolio, called capital, position by company).
4. Run each rule in `lib/mandate-evaluator.ts`:
   - LPA: single-investment cap, follow-on cap, public-securities cap, sector exclusion, geography exclusion.
   - IC charter: stage match, check-size band, ownership floor.
   - Syndicate quality: tier-1 lead required for cheque size, lead has prior rounds in sector.
   - Signing matrix: signers required for cheque size.
5. Stream a `desk.citation` for each rule with `source: 'mandate'` and `ref` = clause path (e.g. `wire_safety §6.2`).
6. Confidence: 1.0 if all rules pass, 0.99 if any blocks (deterministic).

**Block conditions.**
- Any LPA hard limit breached.
- Sector or geography on exclusion list.
- Insufficient signers in matrix for the cheque size.

**Implementation note.** This desk should resolve in < 500ms. It is the cheapest desk and should be the first to land on screen if you want a confidence boost early in the streaming sequence.

### 4.6 Wire safety desk (`agents/desks/wire-safety.ts`)

**Job.** Catch BEC, shell-company impersonation, and sanctioned counterparties before money moves. **This desk fires the demo's BLOCK.**

**Steps.**
1. `desk.start`.
2. Parse wire instructions file (`.pdf` or `.eml`) via `parseWireInstructions(file)`. Extract:
   - `sourceEmailDomain` (where the email came from)
   - `accountHolderName`
   - `bankCountry`, `swift`
   - For `.eml`: parse SPF, DKIM, DMARC headers via `mailauth` package.
3. In parallel:
   - `whoisLookup(sourceEmailDomain)` → registration date.
   - `levenshtein(sourceEmailDomain, verifiedCompanyDomain)` from Companies House data.
   - `sanctionsScreen(receivingEntity)` against OFAC/EU/UK/UN.
   - `pepScreen(beneficialOwners)`.
   - `beneficialOwnerMatch(accountHolderName, companiesHouse.psc)`.
4. Stream citations.
5. Confidence:
   - All checks pass → 0.96
   - Domain age 30–90 days → 0.75 (`flag`)
   - Domain age < 30 days **or** edit-distance ≤ 2 from verified domain → status `block`, confidence 0.99
   - Sanctions or PEP hit → status `block`, confidence 0.99
   - DKIM fail on inbound .eml → status `block`, confidence 0.99

**Block conditions (the demo catches the first one).**
- Source domain edit-distance ≤ 2 from verified company domain → **BEC**.
- Source domain registered < 30 days → **BEC**.
- DKIM/SPF fail on inbound wire-instruction email → **BEC**.
- Account-holder name mismatch with beneficial owner → **shell**.
- Sanctions or PEP hit → **screen**.

**The BEC fixture.** `fixtures/pdfs/wire_instructions_bec.eml` is a real `.eml` file with:
- `From: founder@acrne.co`
- WHOIS for `acrne.co` returns registration date 6 days before run time.
- DKIM signature is invalid.
- Levenshtein(`acrne.co`, `acme.co`) = 1.

The desk catches all three signals. The BLOCK reason in the modal cites domain edit distance, age, and DKIM fail — all three.

---

## 5. Mandate loading and evaluation

### 5.1 Loader (`lib/mandate-loader.ts`)

```ts
import matter from 'gray-matter';
import { readFile } from 'fs/promises';
import { join } from 'path';

export async function loadMandate(): Promise<Mandate> {
  const raw = await readFile(join(process.cwd(), 'MANDATE.md'), 'utf8');
  const { data, content } = matter(raw);
  // data is the YAML frontmatter, parsed as JS object
  // content is the markdown prose (rendered on the Mandate screen)
  const version = inferVersionFromAmendmentLog(content);
  return { ...mapYamlToMandate(data), version, prose: content };
}
```

The version is inferred by counting amendment log table rows. Hacky but right for the demo — the YAML frontmatter doesn't carry a version field because the file IS the version.

### 5.2 Evaluator (`lib/mandate-evaluator.ts`)

Pure functions. No I/O. No LLM. Each rule is one exported function returning `{ pass: boolean; clause: string; detail: string }`.

```ts
export function checkSingleInvestmentCap(
  mandate: Mandate, deal: ParsedDeal, fundState: FundState
): RuleResult {
  const cap = mandate.lpa.singleInvestmentCapPct / 100 * mandate.fund.sizeUsd;
  const exposureAfter = (fundState.positions[deal.companyId] ?? 0) + deal.amountUsd;
  return {
    pass: exposureAfter <= cap,
    clause: 'lpa.single_investment_cap_pct',
    detail: `Exposure after this round: $${exposureAfter.toLocaleString()}; cap: $${cap.toLocaleString()}`,
  };
}
```

The Mandate desk runs all rules and emits one `desk.citation` per rule with `ref` = `clause` and `detail` = `detail`.

---

## 6. Data sources — interface contracts

Each source lives in `lib/sources/*.ts` and exposes a small, typed interface. The cache layer wraps every call.

### 6.1 Specter (`lib/sources/specter.ts`)

```ts
export async function getSpecterCompany(domain: string): Promise<SpecterCompany>;
export async function getSpecterCompanyPeople(companyId: string): Promise<SpecterPerson[]>;
export async function enrichSpecterPerson(name: string, company: string): Promise<SpecterPerson>;
export async function getSpecterInterestSignals(
  companyId: string, investorName: string, sinceDays: number
): Promise<InterestSignal[]>;
export async function getSpecterTransactions(filter: TransactionFilter): Promise<Transaction[]>;
```

Each function:
1. Tries the live Specter MCP/API.
2. On failure or rate-limit, falls back to the matching fixture in `fixtures/specter/`.
3. Returns the result with a `cached: boolean` flag attached.

### 6.2 Companies House, OpenSanctions, WHOIS

Same pattern. Each source exposes 1–3 typed functions, each with a fixture fallback.

### 6.3 LLM wrapper (`lib/sources/llm.ts`)

```ts
export async function structuredCompletion<T>(opts: {
  model: 'gpt-5.5' | 'composer-2';
  system: string;
  user: string;
  schema: ZodSchema<T>;
}): Promise<T>;
```

Used by `parseSPA`, `parseWireInstructions`, `parsePrompt`, `renderMemoSummary`, and the amendment PR rationale generator. Always uses Zod for response validation.

**Model routing default.**
- `gpt-5.5` for memo synthesis and SPA parsing (long-context, structured output).
- `composer-2` (via Cursor SDK) for the amendment PR generation (it edits a file).
- Desks call neither directly — they call `structuredCompletion` with `gpt-5.5`. (Open question — see `OPEN_QUESTIONS.md`.)

---

## 7. Caching and fixture fallback (`lib/cache.ts`)

```ts
export async function cached<T>(
  key: string,
  ttlSeconds: number,
  fetcher: () => Promise<T>,
  fixturePath?: string,
): Promise<T & { cached: boolean }> {
  // 1. Check in-memory cache (Map<string, { value: T; expires: number }>).
  // 2. If hit and not expired, return with cached: false.
  // 3. Otherwise, try fetcher().
  // 4. On success, store and return with cached: false.
  // 5. On failure, if fixturePath is provided, load fixture, return with cached: true.
  // 6. If no fixture, throw.
}
```

Demo runs ~5 times in 12 hours, so a 24h TTL is generous. The fixture fallback is what makes the demo robust to API failures on stage.

---

## 8. Verdict synthesis (`agents/synthesise.ts`)

```ts
export function synthesise(findings: DeskFinding[], mandate: Mandate): Verdict {
  // 1. If any finding is `block` → action: 'hold', blockingDesk = first blocking desk.
  // 2. If any finding has confidence < mandate.calibration.flag_for_review_below
  //    OR status is `flag` → action: 'review'.
  // 3. Else action: 'proceed'.
  // 4. Joint confidence = product of individual desk confidences (geometric).
  // 5. Summary string composed from action + count of passes/flags/blocks.
}
```

Pure function. No I/O. Returns the `Verdict` shape from the contract.

---

## 9. Memo generation (`agents/memo.ts`)

```ts
export async function renderMemo(
  deal: ParsedDeal,
  mandate: Mandate,
  findings: DeskFinding[],
  verdict: Verdict,
): Promise<MemoData> {
  // 1. Build deterministic header data (deal, fund, runId, generatedAt).
  // 2. Use LLM (gpt-5.5) to synthesise the editorial 2-3 sentence summary
  //    given the verdict, blocking desk, and top findings.
  // 3. Generate the recommendation sentence (rule-based template, not LLM).
  // 4. Compose required actions list:
  //      - On hold: ["Out-of-band phone confirmation per §6.4", ...]
  //      - On review: ["Partner review of round dynamics finding", ...]
  //      - On proceed: ["Two-signer sign-off per §5", ...]
  // 5. Return MemoData.
}
```

The LLM is responsible only for the **editorial summary sentence**. The recommendation, required actions, and findings table are deterministic. This keeps the memo trustworthy and avoids hallucinating financial claims.

---

## 10. Amendment PR flow (`agents/amend.ts`)

When the GP clicks "Override and amend" in the BLOCK modal, the UI POSTs to `/api/amend` with `{ runId, override }`.

```ts
export async function draftAmendment(
  runId: string, override: OverrideContext
): Promise<AmendmentDraft> {
  // 1. Load MANDATE.md.
  // 2. Identify the clause that fired the block (carried in OverrideContext).
  // 3. Use Cursor SDK Composer 2 to propose the amendment:
  //      - Input: current MANDATE.md frontmatter + the block context.
  //      - Output: unified diff + rationale paragraph.
  // 4. Construct AmendmentDraft.
  // 5. (Optional) Open a real PR via Octokit if GITHUB_TOKEN is set
  //    and DEMO_GITHUB_REPO is configured. Otherwise return draft only.
}
```

The Cursor SDK is genuinely useful here — Composer 2 is purpose-built for editing code/config files. The prompt is roughly: *"Given this BEC pattern, propose an amendment to the `wire_safety` section of MANDATE.md that prevents this and similar patterns in future. Output a unified diff and a 2-sentence rationale."*

Whether to open a real GitHub PR vs. simulate it visually: see `OPEN_QUESTIONS.md`.

---

## 11. Mock ledger (`lib/ledger.ts`)

```ts
type LedgerEntry = {
  id: string;
  runId: string;
  status: 'queued' | 'held' | 'wired';
  amountUsd: number;
  recipient: string;
  reason?: string;       // populated when status = 'held'
  at: string;
};

const ledger: LedgerEntry[] = [];

export function queueWire(entry: Omit<LedgerEntry, 'id' | 'at'>) { /* ... */ }
export function holdWire(runId: string, reason: string) { /* ... */ }
export function getLedger(): LedgerEntry[] { /* ... */ }
```

The orchestrator calls `queueWire` on a clean PASS and `holdWire` on a BLOCK. The UI can show a small "wire queued" badge on the verdict bar after a clean run. **Don't actually integrate Modern Treasury** unless the team has spare hours late in the build.

---

## 12. Prompt parsing (`agents/orchestrator.ts → parsePrompt`)

The GP's prompt is unstructured English. We parse it once at the start of the run via GPT-5.5 structured output:

```ts
const ParsedDeal = z.object({
  company: z.object({ name: z.string(), domainHint: z.string().optional() }),
  round: z.object({
    stage: z.enum(['pre_seed', 'seed', 'series_a', 'series_b', 'other']),
    leadInvestor: z.string().optional(),
  }),
  amountUsd: z.number(),
  proRataPct: z.number().optional(),
  totalAllocationUsd: z.number().optional(),
});
```

Output flows to every desk. If parsing fails or any required field is missing, the orchestrator emits an `error` event and stops — better to refuse than to act on an unclear instruction.

---

## 13. Environment variables

```dotenv
# Cursor SDK
CURSOR_API_KEY=

# OpenAI
OPENAI_API_KEY=
OPENAI_MEMO_MODEL=gpt-5.5
OPENAI_PARSE_MODEL=gpt-5.5

# Specter
SPECTER_API_KEY=
SPECTER_API_BASE=https://api.tryspecter.com
SPECTER_MCP_URL=https://mcp.tryspecter.com

# Companies House
COMPANIES_HOUSE_API_KEY=

# OpenSanctions (key optional for higher rate limits)
OPENSANCTIONS_API_KEY=

# Demo behaviour
DEMO_FORCE_FIXTURES=false       # set true to bypass live APIs entirely
DEMO_GITHUB_REPO=               # if set, amendments open real PRs
GITHUB_TOKEN=                   # required if DEMO_GITHUB_REPO is set

# App
NODE_ENV=development
PORT=3000
```

`DEMO_FORCE_FIXTURES=true` is the on-stage panic button if the network goes sideways.

---

## 14. Error handling philosophy

Three tiers:

- **Tier 1 — graceful degradation.** A data source 500s or rate-limits: fall to fixture, mark `cached: true`, the desk still resolves. The UI shows `cached @ HH:MM` on affected citations. **This is the default.**
- **Tier 2 — desk failure.** A desk's logic fails (parser breaks, rule throws). The desk resolves with status `flag`, confidence 0.50, primary `"could not complete check"`, and a single citation with `detail: "internal error: <msg>"`. Run continues. The verdict layer treats this as a `flag` → action `review`.
- **Tier 3 — orchestrator failure.** Mandate fails to load, prompt fails to parse, two or more desks tier-2-fail. Orchestrator emits `error` event and closes the SSE stream. The UI shows a clean error state. **Do not retry automatically.**

We never fabricate a finding. We never silently omit a desk. Every event is auditable.

---

## 15. Performance budget

For the demo to feel right:
- `parsePrompt`: < 1.5s.
- Mandate desk: < 500ms.
- Round dynamics desk (LLM-bound): 4–6s.
- Company, Founder, Investor, Wire desks: 3–8s each.
- Total wall time orchestrator → all desks resolved: **< 30s** (90th percentile).

If a desk is expected to land at ~30s in the streaming sequence (the wire safety desk in particular), do **not** speed it up artificially — the staggered resolution is the visible spectacle of the agent thinking. But don't let any single desk exceed 30s — that's the hard timeout.

---

## 16. What the backend deliberately does NOT do

- **Does not send any email** — drafts only, returned as memo content.
- **Does not move real money** — mock ledger only.
- **Does not authenticate users** — single-tenant demo.
- **Does not persist runs** — in-memory only; restart wipes state.
- **Does not run background jobs** — every action is on the request path.
- **Does not call Specter from the browser** — server-only secret keys.
- **Does not retry failed sources** — one attempt, then fixture fallback.
- **Does not log PII** — log run IDs and timing only. The demo data is fictional anyway.