# Backend Agent Brief — Mandate Diligence Engine

This document is the spec for wiring the existing Next.js frontend
(`front-end/`) to a real streaming diligence engine. Read this end-to-end
before you start. No code in this file — implementation follows.

## Constraints

- **Self-hosted, single-instance.** Runs locally on `uvicorn`. No
  multi-process state. No Redis. SQLite for persistence.
- **Offline-capable.** When `OFFLINE_MODE=true` (or any external API key
  is missing), every desk falls back to a scripted fixture so the demo
  works on a laptop with no internet. When keys are set, the desk uses
  the real provider.
- **No auth.** No JWT, no login, no users table. CORS pinned to
  `http://localhost:3000`. Future hardening is out of scope.
- **The LLM never decides outcomes.** Pass / flag / block is determined
  by deterministic rules in `MandateDesk` and `WireSafetyDesk`. The LLM
  only generates analyst-style narrative (`primary`, `facts`, memo
  summary). This is a hard architectural boundary — keep it explicit.

## Frontend → Backend API

Base path `/api`. JSON unless noted. Errors are
`{"error":"...","detail":"..."}`. CORS allows `http://localhost:3000`.

### Mandate document

- `GET /api/mandate` →
  ```json
  { "version": 12,
    "fund": "acme-ventures-iii",
    "last_amended": "2026-04-02",
    "frontmatter_yaml": "fund: acme-ventures-iii\n...",
    "body": [{"tag":"h1","text":"Mandate — Acme Ventures III"}, "..."] }
  ```
  `body` shape matches `MANDATE_BODY` in `front-end/app/state/initial.ts`
  so the existing render code is unchanged.

### Amendments

- `GET /api/amendments` → newest-first array of:
  ```json
  { "id": 14, "date": "2026-04-02", "author": "A. Patel",
    "summary": "...", "lines": "+1",
    "diff": ["  context", "+ added line", "- removed"],
    "active": true,
    "attachments": [{"id":"u_xxx","name":"...","size":"38 KB","kind":"pdf"}] }
  ```
- `POST /api/amendments` — body
  `{summary, author, diff: string, attachment_ids: string[]}`. Server
  splits diff on `\n`, computes `lines` (`+N`, `−N`, `~N`), assigns next
  id, marks all previous `active=false`, bumps mandate version, persists.
  Returns the merged Amendment plus `{new_mandate_version: int}`.

### File uploads

- `POST /api/uploads` — `multipart/form-data` with `file=...`. Stores
  under `UPLOAD_DIR/{uuid}.{ext}`. Returns
  `{id, name, size:"38 KB", kind:"pdf"|"email"|"other"}`.
- `GET /api/uploads/:id` — streams the original file.

### Runs (streaming)

- `POST /api/runs` — body `{prompt: string, file_ids: string[]}` →
  `{run_id}`. Returns immediately; orchestration runs in a background
  task.
- `GET /api/runs/:run_id/events` — **`text/event-stream` SSE**. Use
  `sse-starlette`'s `EventSourceResponse`. Event names and payloads are
  shaped to drop straight into the frontend's `runState` reducers in
  `front-end/app/components/RunScreen.tsx`:
  ```
  event: run-started
  data: {"run_id":"...","started_at":"...","scenario":null}

  event: desk-started
  data: {"idx":0,"n":"01","name":"Company Desk","icon":"building"}

  event: cite
  data: {"idx":0,"cite":{"src":"specter","text":"...","link":false}}

  event: desk-resolved
  data: {"idx":0,"status":"pass"|"flag"|"block",
         "confidence":"0.94","duration_s":"4.2s",
         "primary":"...","facts":"..."}

  event: run-complete
  data: {"verdict":"proceed"|"hold","completed_at":"..."}

  event: error
  data: {"idx":0,"message":"WHOIS lookup timed out"}
  ```
  Six `desk-started`s fire as soon as the run begins (parallel desks).
  Citations arrive as each provider returns. `desk-resolved` is terminal
  per desk. Final `run-complete` after all six.
- `GET /api/runs/:run_id` — denormalized snapshot for back-navigation
  and the IC Memo: `{prompt, files, desks:[...with cites], verdict,
  started_at, completed_at}`. The Memo is rendered client-side from this.

## Desks (the real engine)

Six desks run in parallel via `asyncio.gather`. Each implements a
Protocol with `async def run(self, ctx, emit) -> DeskResult`. `emit` pushes
SSE events through the in-process bus.

| Idx | Desk             | Real provider                          | Offline fallback |
|----:|------------------|----------------------------------------|------------------|
| 01  | Company          | **Companies House API**                | scripted Acme    |
| 02  | Founder          | **Specter People API** + Cursor SDK    | scripted         |
| 03  | Lead Investor    | **Specter Interest Signals API**       | scripted         |
| 04  | Round Dynamics   | **Specter Transactions API** + Cursor SDK (parses uploaded SPA) | scripted |
| 05  | Mandate          | rule-based against current mandate row | rule-based       |
| 06  | Wire Safety      | **WHOIS** (RDAP) + DNS DKIM/SPF + **OpenSanctions API** | scripted (BEC preset emits the lookalike-domain block deterministically) |

## External APIs the backend will call

All optional — every one has an offline fallback. Keys read from `.env`.

1. **Cursor SDK** (`CURSOR_API_KEY`) — analyst-style narrative for
   `primary` / `facts` strings and the memo summary. **Never** decides
   outcomes. Used by Founder, Round Dynamics, and the memo summarizer.

2. **Specter API** (`SPECTER_API_KEY`) — three endpoints:
   - People (founder lookup) — `GET /v1/people?...`
   - Interest Signals (lead-investor activity)
   - Transactions (round benchmarks)

3. **OpenSanctions API** (`OPENSANCTIONS_API_KEY`, free tier exists) —
   `POST /match/sanctions` for the wire-safety sanctions screen. Open
   data; can also be self-hosted by mounting their dataset locally
   (`opensanctions-dataset` Docker image) — note this in `.env.example`.

4. **Companies House API** (`COMPANIES_HOUSE_API_KEY`, free) —
   `GET /company/{number}` for company status, incorporation date,
   officers. UK only; for US/EU companies the desk skips and emits a
   "limited data" cite.

5. **WHOIS / RDAP** — domain age, registrar. No key needed; use the
   `whodap` Python library which talks to public RDAP endpoints. Used by
   Wire Safety desk to detect lookalike domains and check registration
   age.

6. **DNS / DKIM / SPF** — no external service; resolve TXT/CNAME records
   with `dnspython`. Used by Wire Safety.

That is the full external surface area. Everything else (rule
evaluation, diff parsing, file storage) is local.

## Database

- SQLite at `./underwriter.db` (path from `DATABASE_URL` in `.env`).
- Use SQLAlchemy 2.0 + Alembic. One migration to bootstrap.
- Tables: `mandates`, `amendments`, `amendment_attachments`, `uploads`,
  `runs`, `run_files`, `desks`, `cites`. No `users` table.
- `mandates` is append-only; one row marked `active=true`. New
  amendments insert a new mandate row with bumped version and flip
  active.
- On first boot, if `mandates` is empty, seed v12 and the four initial
  amendments (PR #14, #12, #11, #9) from
  `front-end/app/state/initial.ts` so the app has something to show.

## Folder layout

```
backend/app/
  main.py                  # FastAPI, CORS for :3000, router include, startup seeds
  core/
    config.py              # pydantic-settings, reads .env
    db.py                  # engine, SessionLocal, Base
  deps.py                  # get_db
  models/                  # SQLAlchemy: mandate, amendment, upload, run, desk, cite
  schemas/                 # Pydantic v2: mandate, amendment, upload, run, sse_event
  routers/
    mandate.py amendments.py uploads.py runs.py
  services/
    amendments.py          # diff parsing, version bump
    uploads.py             # disk write, mime → kind
    runs/
      orchestrator.py      # spawns desks in parallel, owns event bus
      eventbus.py          # dict[run_id, list[asyncio.Queue]]
      desks/
        base.py            # Protocol + DeskResult
        company.py founder.py lead_investor.py round_dynamics.py mandate.py wire_safety.py
      providers/
        companies_house.py specter.py opensanctions.py whois.py dns_check.py cursor.py
      fixtures/
        clean.py bec.py    # offline-mode replay timings + cites
alembic/versions/
seeds/
  acme_spa.pdf             # demo SPA
  wire_instructions_clean.pdf
  wire_instructions_bec.eml
tests/
```

## Streaming pattern (SSE)

```python
# routers/runs.py
@router.get("/runs/{run_id}/events")
async def stream(run_id: str):
    q = await orchestrator.subscribe(run_id)
    async def gen():
        try:
            while (evt := await q.get()) is not None:
                yield {"event": evt.type, "data": json.dumps(evt.data)}
        finally:
            await orchestrator.unsubscribe(run_id, q)
    return EventSourceResponse(gen())
```

`orchestrator` keeps `dict[run_id, list[asyncio.Queue]]`. Each desk's
`emit` callback fans out to every subscriber queue. Single-process is
sufficient — this is a self-hosted demo.

## Required `requirements.txt` additions

```
sqlalchemy>=2.0
alembic
pydantic-settings
python-multipart        # multipart uploads
sse-starlette           # SSE
httpx                   # outbound HTTP for providers
dnspython               # DNS / DKIM / SPF
whodap                  # WHOIS via RDAP
cursor-sdk              # LLM (or whichever package the Cursor SDK ships as)
pytest pytest-asyncio
```

## `.env.example` additions

The existing file already has runtime / DB / `UPLOAD_DIR`. Add:

```bash
# Demo mode — when true, every desk uses scripted fixtures regardless of keys.
OFFLINE_MODE=false

# External providers (all optional; missing key = that desk falls back to fixture)
CURSOR_API_KEY=
SPECTER_API_KEY=
OPENSANCTIONS_API_KEY=
COMPANIES_HOUSE_API_KEY=

# CORS — for the Next.js frontend
CORS_ORIGINS=http://localhost:3000
```

Drop the JWT and bootstrap-admin entries — not needed.

## Acceptance — what "done" looks like

1. `cd backend && uvicorn app.main:app --reload` boots clean. `/docs`
   renders OpenAPI for every route above.
2. With `OFFLINE_MODE=true` and **no internet**: hit the running Next.js
   frontend on `:3000`, click *Clean Acme deal* → *Run Diligence*. Six
   tiles stream and resolve via real SSE events from the backend (the
   timing matches the current fixture choreography). Verdict bar settles
   on PROCEED. Memo loads.
3. Same path, BEC preset → wire-safety desk emits a `block` event;
   BLOCK modal pops; *Override and amend → Approve & merge* hits
   `POST /api/amendments`; refreshing the Mandate screen still shows the
   new agent-authored PR.
4. With keys set and `OFFLINE_MODE=false`: Companies House returns real
   data for a real UK company id in the prompt; WHOIS returns the real
   registration date for whichever domain is in the wire instructions.
5. `pytest backend/tests` passes — at minimum: orchestrator publishes
   six desk-resolveds in parallel; amendment POST persists and bumps
   version; offline-mode harness runs end-to-end with no network mocks.
