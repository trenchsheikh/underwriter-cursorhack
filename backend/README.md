# UnderWriter — Backend

Autonomous underwriting backend for the UnderWriter demo. Implements the brief
in [`docs/Backend.md`](docs/Backend.md): six diligence desks fanning out in
parallel against real data sources (with fixture fallbacks), an SSE event
stream into the UI, a synthesised verdict, an IC memo, and an amendment-PR
draft when the GP overrides a block.

The Specter integration follows
[`docs/SPECTER_FLOW.md`](docs/SPECTER_FLOW.md) end-to-end: a single
`SpecterSnapshot` is built once per run from the documented endpoints
(`POST /companies`, `GET /companies/{id}/people`, `GET /people/{id}`,
`GET /companies/{id}/similar`) under `X-API-Key` auth, with the §0 error
semantics, the §3b derived fields (`prior_exits`, `stealth_history`,
`departed_subject_company`), and the §4 cross-step underwriting flags
(`founder_departed_before_close`, `ex_founder_now_at_investor`,
`funding_outlier_high|low`). The four Specter-consuming desks (Company,
Founder, Lead Investor, Round Dynamics) read from that snapshot rather than
re-hitting the API.

This is a Next.js Route-Handler app (Next 16 / React 19). The frontend is in
[`../front-end`](../front-end).

## Layout

```
backend/
├── MANDATE.md                       # the policy file the loader parses
├── app/
│   ├── layout.tsx
│   ├── page.tsx
│   └── api/
│       ├── run/route.ts             # POST — starts a run, streams SSE events
│       ├── memo/[runId]/route.ts    # GET — returns MemoData
│       ├── amend/route.ts           # POST — proposes amendment PR
│       └── health/route.ts          # GET — liveness probe
├── agents/
│   ├── orchestrator.ts              # entrypoint; builds SpecterSnapshot, fans out 6 desks
│   ├── parse-prompt.ts              # prompt → ParsedDeal (incl. dex-meetdex seed)
│   ├── synthesise.ts                # findings → verdict
│   ├── memo.ts                      # findings + verdict → MemoData
│   ├── amend.ts                     # override → AmendmentDraft
│   └── desks/
│       ├── company.ts               # consumes snapshot.company + Companies House
│       ├── founder.ts               # consumes snapshot.founders + sanctions/PEP
│       ├── investor.ts              # consumes snapshot.company.{investors,highlights}
│       ├── round.ts                 # consumes snapshot.peers + SPA
│       ├── mandate.ts               # pure mandate-evaluator
│       └── wire-safety.ts           # WHOIS + sanctions + DKIM/SPF + BO match
├── lib/
│   ├── contract.ts                  # shared types (THE SEAM)
│   ├── types.ts                     # internal types (Mandate, ParsedDeal, SpecterContext…)
│   ├── mandate-loader.ts            # parses MANDATE.md frontmatter
│   ├── mandate-evaluator.ts         # pure rule evaluation
│   ├── ledger.ts                    # mock wire ledger
│   ├── cache.ts                     # in-memory + fixture fallback
│   ├── util.ts
│   └── sources/
│       ├── specter.ts               # SPECTER_FLOW.md implementation (HTTP + snapshot)
│       ├── companies-house.ts
│       ├── opensanctions.ts
│       ├── whois.ts
│       ├── pdf-parse.ts
│       └── llm.ts                   # @cursor/sdk → OpenAI → deterministic chat wrapper
├── fixtures/
│   ├── specter/snapshots/           # canonical SpecterSnapshot fixtures (dex.json, acme.json)
│   ├── companies-house/…
│   ├── opensanctions/…
│   ├── whois/…
│   ├── pdfs/…
│   └── fund-state.json
├── scripts/smoke.ts                 # local end-to-end driver (clean + BEC + Dex)
└── docs/                            # Backend.md (architecture brief) + SPECTER_FLOW.md
```

## API

All endpoints are versionless and consumed by the Next.js frontend over HTTP.

| Method | Path | Description |
| ------ | ---- | ----------- |
| GET    | `/api/health`           | Liveness probe |
| POST   | `/api/run`              | Start a diligence run; streams `RunEvent` lines as SSE (`text/event-stream`) |
| GET    | `/api/memo/{runId}`     | Returns `MemoData` for a completed run |
| POST   | `/api/amend`            | Drafts an amendment PR from an `OverrideContext` |

The full SSE event schema lives in `lib/contract.ts`. Both halves of the team
(backend + UI) import from that file.

`RunRequest.fixtureSeed` accepts:

| Seed             | Scenario                                                  |
| ---------------- | --------------------------------------------------------- |
| `clean-acme`     | Clean Series A; six PASS desks; verdict `proceed`.        |
| `bec-acme`       | Business-Email-Compromise wire instructions; wire-safety `block`; amendment draft. |
| `dex-meetdex`    | SPECTER_FLOW.md canonical fixture for Dex (`meetdex.ai`); founder-departure + investor-overlap flags surface; verdict `review`. |

## Quick start

```bash
cd backend
npm install
npm run dev
# Backend runs at http://localhost:3001
```

The defaults run entirely against fixtures — no API keys required. Copy
`.env.example` to `.env` if you want to plug in Specter / OpenAI / Companies
House / OpenSanctions later.

### Smoke test

A local driver exercises all three seeded scenarios end-to-end (no UI
required):

```bash
npm run dev          # in one tmux window
npm run smoke        # in another
```

The smoke script POSTs each fixture to `/api/run`, consumes the SSE stream,
fetches the resulting memo, asserts the expected verdict, drafts the
amendment PR for the BEC run, and asserts that the Dex run surfaces both
SPECTER_FLOW.md §4 flags (`founder_departed_before_close` and
`ex_founder_now_at_investor`).

### curl reference

Health probe:

```bash
curl -s http://localhost:3001/api/health
```

Run the SPECTER_FLOW canonical Dex scenario and watch the SSE stream:

```bash
curl -sN -X POST http://localhost:3001/api/run \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Wire $2,650,000 to Dex for their Seed. Lead is Andreessen Horowitz. 50% pro-rata of our $5,300,000 allocation. SPA attached.",
    "files": [
      {"name":"dex_spa.pdf","mime":"application/pdf","size":0,"ref":"spa"},
      {"name":"wire_instructions_clean.pdf","mime":"application/pdf","size":0,"ref":"wi-clean"}
    ],
    "fixtureSeed": "dex-meetdex"
  }'
```

Fetch the memo for any completed run:

```bash
curl -s http://localhost:3001/api/memo/<runId>
```

Propose an amendment PR draft from a wire-safety block:

```bash
curl -s -X POST http://localhost:3001/api/amend \
  -H "Content-Type: application/json" \
  -d '{
    "runId": "<runId>",
    "blockingDesk": "wire",
    "blockingReason": "BEC pattern detected",
    "clause": "wire_safety §6.2",
    "rationale": "Confirmed BEC pattern; tighten policy."
  }'
```

## Specter source — `lib/sources/specter.ts`

The Specter source is a faithful implementation of
[`docs/SPECTER_FLOW.md`](docs/SPECTER_FLOW.md):

- **Auth & base URL** — `X-API-Key: $SPECTER_API_KEY` against
  `https://app.tryspecter.com/api/v1` (override with `SPECTER_API_BASE`).
  Live mode is gated by the key and disabled by `DEMO_FORCE_FIXTURES=true`
  or `OFFLINE_MODE=true`.
- **Error semantics** — `404 NOT_FOUND` (clean JSON), `404 WRONG_PATH`
  (HTML body), `403 NOT_PERMITTED`, `400 VALIDATION_ERROR`, `429 RATE_LIMIT`
  are surfaced as a typed `SpecterError`. Rate-limit headers
  (`x-ratelimit-remaining`, `x-ratelimit-reset`) are honoured.
- **Endpoints used** — `POST /companies` (§1), `GET /companies/{id}/people`
  (§2), `GET /people/{id}` (§3), `GET /companies/{id}/similar` (§5),
  `GET /companies/{id}` (per-peer fan-out for §5).
- **Investor-interest** — §7 explicitly NOT WIRED in this build (saved
  Investor Interest searches required); Desk 03 falls back to
  `funding.investors[]` + the `top_tier_investors` / `raised_last_month`
  highlight tile. Tagged in code and in the Lead Investor desk's facts.
- **Snapshot output** — `SpecterSnapshot` matches §8 exactly: `company`,
  `founders[]` (with §3b derived fields), `peers` (with caveat string), and
  `flags[]` from §4 cross-step computation (`founder_departed_before_close`,
  `ex_founder_now_at_investor`, `funding_outlier_high|low`,
  `web_traffic_dip_during_growth`).
- **Caching** — snapshot is memoised by `specter_id` / `website_url` /
  `seed` for the lifetime of the process; per §6.1 of `Backend.md`, a re-run
  on the same company does not re-hit Specter.
- **Fixture fallback** — when no key is present, when offline mode is on,
  or when a live call fails, the snapshot resolves from
  `fixtures/specter/snapshots/{dex,acme}.json`. The Dex fixture is the
  worked example from `SPECTER_FLOW.md` §"Worked example".

## Demo behaviour

- `DEMO_FORCE_FIXTURES=true` makes every source skip live calls and serve
  from `fixtures/`. Use this on stage if the network goes sideways.
- **clean Acme** → all six desks pass; verdict `proceed`.
- **BEC Acme** → wire-safety `block` on lookalike domain + young domain +
  DKIM fail; `/api/amend` drafts the policy patch.
- **Dex (meetdex.ai)** → SPECTER_FLOW.md canonical run. Specter snapshot
  surfaces Harry Uglow's exit 26 days before the Seed close and his current
  "a16z speedrun scout" tagline overlapping the round's investors. The
  Founder desk turns to `flag` and the verdict is `review` — the data does
  not block the deal but the AI underwriter has surfaced what a human reader
  might miss.

## Build & checks

```bash
npm run typecheck    # tsc --noEmit
npm run smoke        # POST clean + BEC + Dex; assert verdicts and flags
npm run build        # next build (Next 16 production build)
```

## What this backend deliberately does NOT do

(Backend.md §16, summarised.) No email sending, no real money movement, no
authentication, no run persistence beyond process memory, no background
jobs, no Specter calls from the browser, no automatic retries, no PII
logging. The Specter Investor-Interest endpoint is documented but
explicitly not wired (`SPECTER_FLOW.md` §7); it is unblocked by creating a
saved Investor Interest search in the Specter UI and reading
`/searches` → `/investor-interest-searches/{query_id}/results`.
