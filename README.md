# UnderWriter

Autonomous VC-underwriting demo: a Cursor-driven agent that fans out six
diligence desks, streams findings to the UI over SSE, synthesises a verdict
(`PROCEED` / `REVIEW` / `HOLD`) and either queues a wire or holds and proposes
a mandate amendment.

This repo is a two-app workspace:

- [`backend/`](./backend) — Next.js 16 / React 19 Route Handlers. Six desks,
  SSE streaming, fixture fallbacks. The brief is
  [`backend/docs/Backend.md`](./backend/docs/Backend.md). Entrypoint:
  `backend/app/api/run/route.ts`.
- [`front-end/`](./front-end) — Next.js 16 / React 19 UI (mandate / run /
  memo screens).

## Quick start

```bash
# Backend (port 3001) — runs end-to-end against fixtures, no API keys required
cd backend
npm install
npm run dev
```

In a second terminal:

```bash
cd backend
npm run smoke
```

The smoke driver POSTs the seeded `clean-acme` and `bec-acme` scenarios to
`/api/run`, prints the streaming desk events, fetches the resulting memo, and
draws the amendment-PR draft for the BEC run.

For the UI:

```bash
cd front-end
npm install
npm run dev
```

## Backend API

All endpoints are versionless and consumed by the UI over HTTP.

| Method | Path | Description |
| ------ | ---- | ----------- |
| `GET`  | `/api/health`        | Liveness probe |
| `POST` | `/api/run`           | Start a diligence run; streams `RunEvent` lines as SSE (`text/event-stream`) |
| `GET`  | `/api/memo/{runId}`  | Returns `MemoData` for a completed run |
| `POST` | `/api/amend`         | Drafts an amendment PR from an `OverrideContext` |

The full SSE event schema lives in
[`backend/lib/contract.ts`](./backend/lib/contract.ts). Both the backend and
the UI import from that file.

### Curl smoke

```bash
# Health
curl -s http://localhost:3001/api/health

# Streaming run (clean Acme — expected verdict: proceed, 6/6 desks pass)
curl -N -X POST http://localhost:3001/api/run \
  -H 'Content-Type: application/json' \
  -d '{
    "prompt": "Wire $2,000,000 to Acme Robotics for their Series A. Lead is Sequoia. 50% pro-rata of our $4,000,000 allocation.",
    "files": [
      {"name":"acme_spa.pdf","mime":"application/pdf","size":0,"ref":"spa"},
      {"name":"wire_instructions_clean.pdf","mime":"application/pdf","size":0,"ref":"wi-clean"}
    ],
    "fixtureSeed": "clean-acme"
  }'

# Memo for a completed run
curl -s http://localhost:3001/api/memo/<runId>

# Amend (draft a PR after a wire-safety BLOCK)
curl -s -X POST http://localhost:3001/api/amend \
  -H 'Content-Type: application/json' \
  -d '{
    "runId": "<runId>",
    "blockingDesk": "wire",
    "blockingReason": "Lookalike domain acrne.co vs verified acme.co — wire_safety §6.2",
    "clause": "wire_safety §6.2",
    "rationale": "Confirmed BEC pattern; tighten policy."
  }'
```

## Demo behaviour

- `DEMO_FORCE_FIXTURES=true` makes every source skip live calls and serve from
  `backend/fixtures/`. Use this on stage if the network goes sideways.
- The clean Acme deal resolves all six desks PASS and produces a `proceed`
  verdict.
- The BEC Acme deal lands a wire-safety BLOCK with four signals: lookalike
  domain (edit distance 2 from `acme.co`), domain age 6 days, DKIM fail, and
  beneficial-owner mismatch — driving a `hold` verdict.

## Agent runtime

LLM-backed narrative generation in the pipeline (the IC memo summary and the
amendment rationale) is wired through the
[Cursor TypeScript SDK](https://cursor.com/blog/typescript-sdk)
([docs](https://cursor.com/docs/sdk/typescript)). When `CURSOR_API_KEY` is
set, those call sites run a one-shot `@cursor/sdk` `Agent.prompt()` against
the same agent runtime that powers the Cursor IDE, CLI, and Cloud Agents.
Without a key, the backend silently falls back to OpenAI (if configured) and
then to deterministic templates — the demo always works keyless.

See [`backend/lib/sources/llm.ts`](./backend/lib/sources/llm.ts) for the
wrapper.

## Configuration

All external APIs (Specter, Companies House, OpenSanctions, WHOIS, OpenAI,
Cursor SDK) are optional — the backend defaults to fixtures and runs cleanly
with no keys set. See [`backend/.env.example`](./backend/.env.example) for
the full list.

## Build / typecheck

```bash
cd backend
npm run typecheck
npm run build
```

## License

Internal hackathon project.
