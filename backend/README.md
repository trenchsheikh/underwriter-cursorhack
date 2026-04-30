# Mandate — Backend

Autonomous underwriting backend for the Mandate demo. Implements the brief in
[`docs/Backend.md`](docs/Backend.md): six diligence desks fanning out in parallel
against real data sources (with fixture fallbacks), an SSE event stream into the
UI, a synthesised verdict, an IC memo, and an amendment-PR draft when the GP
overrides a block.

This is a Next.js Route-Handler app (Next 16 / React 19). The frontend is in
[`../front-end`](../front-end).

## Layout

The folder structure mirrors `docs/Backend.md` §1:

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
│   ├── orchestrator.ts              # entrypoint; fans out 6 desks
│   ├── parse-prompt.ts              # prompt → ParsedDeal
│   ├── synthesise.ts                # findings → verdict
│   ├── memo.ts                      # findings + verdict → MemoData
│   ├── amend.ts                     # override → AmendmentDraft
│   └── desks/
│       ├── company.ts
│       ├── founder.ts
│       ├── investor.ts
│       ├── round.ts
│       ├── mandate.ts
│       └── wire-safety.ts
├── lib/
│   ├── contract.ts                  # shared types (THE SEAM)
│   ├── types.ts                     # internal types (Mandate, ParsedDeal…)
│   ├── mandate-loader.ts            # parses MANDATE.md frontmatter
│   ├── mandate-evaluator.ts         # pure rule evaluation
│   ├── ledger.ts                    # mock wire ledger
│   ├── cache.ts                     # in-memory + fixture fallback
│   ├── util.ts
│   └── sources/
│       ├── specter.ts
│       ├── companies-house.ts
│       ├── opensanctions.ts
│       ├── whois.ts
│       ├── pdf-parse.ts
│       └── llm.ts                   # OpenAI-compatible chat wrapper
├── fixtures/
│   ├── specter/…
│   ├── companies-house/…
│   ├── opensanctions/…
│   ├── whois/…
│   ├── pdfs/…
│   └── fund-state.json
├── scripts/smoke.ts                 # local end-to-end driver
└── docs/                            # the original brief + architecture
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

A local driver exercises both seeded scenarios end-to-end (no UI required):

```bash
npm run dev          # in one tmux window
npm run smoke        # in another
```

The smoke script POSTs the clean and BEC fixtures to `/api/run`, prints the
streaming events as they arrive, fetches the resulting memo, and prints the
amendment draft for the BEC run.

## Demo behaviour

- `DEMO_FORCE_FIXTURES=true` makes every source skip live calls and serve from
  `fixtures/`. Use this on stage if the network goes sideways.
- The clean Acme deal resolves all six desks PASS and produces a PROCEED verdict.
- The BEC Acme deal lands a wire-safety BLOCK with three signals: lookalike
  domain (edit distance 1 from `acme.co`), domain age 6 days, and DKIM fail.

## Build

```bash
npm run typecheck    # tsc --noEmit
npm run build        # next build
```

## What this backend deliberately does NOT do

(Backend.md §16, summarised.) No email sending, no real money movement, no
authentication, no run persistence beyond process memory, no background jobs,
no Specter calls from the browser, no automatic retries, no PII logging.
