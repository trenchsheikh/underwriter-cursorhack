# Frontend ↔ Backend Integration Guide

A practical guide for wiring the Next.js frontend (`front-end/`) up to the
UnderWriter backend (`backend/`). It covers the four HTTP endpoints, the
shared TypeScript contract, the SSE event stream, and the two seeded demo
flows (clean PASS / BEC BLOCK + amendment).

The shared types live in [`backend/lib/contract.ts`](../lib/contract.ts) and
**that file is the seam**: any change to the wire format must be agreed by
both halves of the team. The frontend should import from a copy (or a
symlink / shared package) of that exact file — do not redeclare these types
ad-hoc on the UI side.

If you only read one section: read **§3 (Contract)** and **§4 (Run flow)**.
Everything else is sugar.

---

## 1. Servers and ports

| Server   | Default port | Start command                         |
| -------- | ------------ | ------------------------------------- |
| Backend  | `3001`       | `cd backend && npm install && npm run dev` |
| Frontend | `3000`       | `cd front-end && npm install && npm run dev` |

The frontend should hit the backend over the same origin via a relative
path in production. For local dev, point at `http://localhost:3001`.

Recommended pattern: a single typed client module in
`front-end/app/lib/api.ts` that owns the base URL.

```ts
const API_BASE =
  process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:3001";
```

Set `NEXT_PUBLIC_BACKEND_URL` in `front-end/.env.local` if you want to
override it.

### CORS

The backend currently has no explicit CORS config. For local dev,
calling `http://localhost:3001` from `http://localhost:3000` works for
JSON `fetch` and `EventSource` because both are running on `localhost`
and the browser treats them as same-site for SSE. If you hit a CORS
issue, the cheapest fix is a Next.js rewrite in `front-end/next.config.ts`:

```ts
async rewrites() {
  return [
    { source: "/api/:path*", destination: "http://localhost:3001/api/:path*" },
  ];
}
```

That makes the frontend talk to its own origin (`/api/...`) which proxies
to the backend. Strongly recommended — it also means production deploys
behind a single domain "just work".

---

## 2. Endpoints at a glance

| Method | Path                  | Body / Params                              | Response                                  |
| ------ | --------------------- | ------------------------------------------ | ----------------------------------------- |
| GET    | `/api/health`         | —                                          | `{ status, service, time }`               |
| POST   | `/api/run`            | `RunRequest` JSON                          | SSE stream of `RunEvent` lines            |
| GET    | `/api/memo/{runId}`   | path param `runId`                         | `MemoData` JSON (404 if not finished)     |
| POST   | `/api/amend`          | `OverrideContext` JSON                     | `AmendmentDraft` JSON                     |

All endpoints are `Content-Type: application/json` for request bodies and
JSON or `text/event-stream` for responses. No auth, no cookies. The demo
is single-tenant.

---

## 3. The contract (shared types)

`backend/lib/contract.ts` exports every type the UI needs. Key shapes:

```ts
type DeskId =
  | "company" | "founder" | "investor"
  | "round"   | "mandate" | "wire";

type Status = "idle" | "streaming" | "pass" | "flag" | "block";

interface Citation {
  source: "specter" | "companies-house" | "opensanctions"
        | "whois"   | "mandate"         | "spa" | "linkedin";
  ref: string;          // ID, URL fragment, or short reference
  url?: string;
  detail?: string;      // human-readable context (good for tooltips)
  cached?: boolean;     // true if served from a fixture; show a badge
}

interface DeskFinding {
  desk: DeskId;
  number: "01" | "02" | "03" | "04" | "05" | "06";
  title: string;        // tile header label, e.g. "COMPANY DESK"
  status: "pass" | "flag" | "block";
  confidence: number;   // 0..1
  durationMs: number;
  primary: string;      // 1-line tile headline
  facts: string[];      // 2–4 supporting bullets
  citations: Citation[];
  raw?: unknown;        // optional, for the drawer's "show raw" toggle
}

interface Verdict {
  action: "proceed" | "review" | "hold";
  confidence: number;   // joint confidence across desks
  summary: string;      // 1-line headline for the verdict bar
  blockingDesk?: DeskId;
  blockingReason?: string; // human-readable, used in the BLOCK modal
}
```

### How to share the file

Pick one. Easiest first:

1. **Copy on bootstrap**: `cp backend/lib/contract.ts front-end/app/lib/contract.ts`
   and re-copy whenever it changes. Add a `predev`/`prebuild` script if you
   want it automated.
2. **Path alias**: in `front-end/tsconfig.json` add
   `"paths": { "@contract": ["../backend/lib/contract.ts"] }` and
   `"baseUrl": "."`. Imports become `import type { RunEvent } from "@contract";`.
3. **Workspace package**: extract `lib/contract.ts` into a tiny
   `packages/contract` and have both `backend/` and `front-end/` depend on
   it. Cleanest, but more setup.

For the hackathon, option 1 or 2 is fine. The contract is `type`-only —
nothing executes — so there is no runtime cost.

---

## 4. Run flow — POST `/api/run` (SSE)

The big one. The UI screen calls this when the GP clicks "Run" on the
mandate / deal screen.

### Request

```ts
interface RunRequest {
  prompt: string;
  files: { name: string; mime: string; size: number; ref: string }[];
  fixtureSeed?: "clean-acme" | "bec-acme";
}
```

`ref` is either an uploaded blob id or a fixture id. For the demo, set
`fixtureSeed` to `"clean-acme"` or `"bec-acme"` and the backend will
ignore the file payload and use the seeded fixtures end-to-end. The two
seeds are the entire demo:

- `"clean-acme"` → all six desks PASS → verdict `proceed` → wire queued.
- `"bec-acme"` → wire-safety desk BLOCKs (lookalike domain + 6-day-old
  registration + DKIM fail) → verdict `hold` → triggers the override flow.

### Response — SSE

`Content-Type: text/event-stream`. Every line that starts with `data: `
is one JSON-encoded `RunEvent`. Events end with a blank line (`\n\n`).

**Event order** is guaranteed:

1. `run.init` — exactly once, first.
2. For each desk (six, in parallel, interleaved):
   - `desk.start` — exactly once.
   - `desk.progress` — zero or more (status text for the spinner).
   - `desk.citation` — zero or more (each as a source resolves).
   - `desk.resolved` — exactly once.
3. `verdict` — exactly once, after all six `desk.resolved`.
4. `memo.ready` — exactly once, last.
5. `error` — at most once; closes the stream early.

```ts
type RunEvent =
  | { type: "run.init";      run: RunInit }
  | { type: "desk.start";    desk: DeskId }
  | { type: "desk.progress"; desk: DeskId; message: string }
  | { type: "desk.citation"; desk: DeskId; citation: Citation }
  | { type: "desk.resolved"; finding: DeskFinding }
  | { type: "verdict";       verdict: Verdict }
  | { type: "memo.ready";    memoId: string }
  | { type: "error";         desk?: DeskId; message: string };
```

### Why not `EventSource`?

`EventSource` is `GET`-only. Our run endpoint is `POST` (the body is the
prompt + files). Use `fetch` with a streaming reader instead. Reference
implementation, lifted from `backend/scripts/smoke.ts`:

```ts
import type { RunEvent } from "@contract";

export async function startRun(
  body: RunRequest,
  onEvent: (ev: RunEvent) => void,
  signal?: AbortSignal,
): Promise<void> {
  const res = await fetch(`${API_BASE}/api/run`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok || !res.body) {
    throw new Error(`/api/run: ${res.status}`);
  }

  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });

    let idx;
    while ((idx = buf.indexOf("\n\n")) !== -1) {
      const chunk = buf.slice(0, idx);
      buf = buf.slice(idx + 2);
      const line = chunk.split("\n").find((l) => l.startsWith("data: "));
      if (!line) continue;
      onEvent(JSON.parse(line.slice(6)) as RunEvent);
    }
  }
}
```

Things to remember:

- **Buffer across chunks.** A single `read()` may deliver a partial event;
  the `\n\n` split above handles that.
- **Cancel cleanly.** Pass an `AbortController.signal` and call
  `controller.abort()` when the user navigates away or clicks a "stop"
  button. The backend tolerates client disconnects.
- **Don't retry on error.** Per backend §14, an `error` event is terminal.
  Show a clean error state and let the user start a new run.
- **Watch ordering.** Always set tile state from `desk.start` /
  `desk.resolved`. The `desk.citation` events stream as sources resolve
  and are intentionally interleaved across desks — append, don't replace.

### Suggested UI state model

```ts
type DeskState = {
  status: Status;                  // "idle" | "streaming" | "pass" | "flag" | "block"
  progress?: string;               // last `desk.progress` message
  citations: Citation[];           // accumulated, in arrival order
  finding?: DeskFinding;           // populated on `desk.resolved`
};

type RunState = {
  runId?: string;
  startedAt?: string;
  mandateVersion?: number;
  fundId?: string;
  desks: Record<DeskId, DeskState>;
  verdict?: Verdict;
  memoId?: string;
  error?: { desk?: DeskId; message: string };
};
```

A reducer that switches on `event.type` writes maps cleanly to a `useReducer`.

### Deciding what to render

- `desk.status === "pass"` → green tile with checkmark.
- `desk.status === "flag"` → amber tile, surface `primary` + first fact.
- `desk.status === "block"` → red tile; tile gets the BLOCK badge.
- `verdict.action === "proceed"` → enable "Wire" CTA, badge "queued".
- `verdict.action === "review"` → "Send to partner" CTA.
- `verdict.action === "hold"` → BLOCK modal (see §6).
- `Citation.cached === true` → small grey "cached @ HH:MM" pill on the chip.

---

## 5. Memo — GET `/api/memo/{runId}`

Once you've seen the `memo.ready` event, fetch the memo:

```ts
const res = await fetch(`${API_BASE}/api/memo/${runId}`);
if (res.status === 404) {
  // run not yet finished, or unknown runId — back off and retry once
}
const memo = (await res.json()) as MemoData;
```

`MemoData` shape:

```ts
interface MemoData {
  runId: string;
  fund: { name: string; id: string };
  deal: { company: string; round: string; amountUsd: number; proRataPct?: number };
  verdict: Verdict;
  findings: DeskFinding[];   // same ones the UI already rendered as tiles
  summary: string;            // 2–3 sentence editorial lede
  recommendation: string;     // 1 sentence
  requiredActions: string[];  // ordered list, render as a checklist
  generatedAt: string;        // ISO 8601
}
```

Notes:

- Memos are **in-memory only** on the backend. Restart the backend dev
  server and `/api/memo/{runId}` will 404 for old runs. For the demo
  this is fine: the UI navigates straight from a run to its memo.
- The memo's `findings` are identical to the `DeskFinding` objects you
  accumulated from `desk.resolved` events. You can render the memo
  entirely from in-memory run state if you want; fetching `/api/memo`
  primarily gets you `summary`, `recommendation`, and `requiredActions`.

---

## 6. Amendment — POST `/api/amend`

When the GP clicks "Override and amend" in the BLOCK modal, post the
override context. The backend uses Composer 2 (or fixture fallback) to
draft a unified diff against `MANDATE.md` and returns it for display.

### Request — `OverrideContext`

```ts
interface OverrideContext {
  runId: string;
  blockingDesk: DeskId;     // typically "wire" for the demo
  blockingReason: string;   // copy from verdict.blockingReason
  clause: string;           // mandate clause path that fired, e.g. "wire_safety §6.2"
  rationale?: string;       // free-text from the GP in the modal
}
```

### Response — `AmendmentDraft`

```ts
interface AmendmentDraft {
  runId: string;
  branch: string;     // e.g. "amend/lookalike-domain"
  diff: string;       // unified diff against MANDATE.md
  prTitle: string;
  prBody: string;     // markdown; render with a markdown component
  prUrl?: string;     // populated if a real PR was opened (DEMO_GITHUB_REPO set)
}
```

Render the `diff` in a code block and the `prBody` as markdown. If
`prUrl` is present, link to it. Otherwise show the simulated state.

The error responses from this endpoint are:

- `400` `{ error: "invalid json" }` — body did not parse.
- `400` `{ error: "runId and blockingDesk are required" }` — missing fields.

---

## 7. Health — GET `/api/health`

```json
{ "status": "ok", "service": "underwriter-backend", "time": "2024-..." }
```

Use this for a startup probe in dev (e.g. block the `Run` button until
`/api/health` is reachable).

---

## 8. End-to-end demo flow (UI choreography)

1. **Mandate screen.** Static markdown render of `backend/MANDATE.md`. Not
   wired to any backend endpoint — the file is served from the repo.
2. **Run screen.** GP types prompt, drops two files, clicks "Run".
   - UI calls `POST /api/run` with `fixtureSeed: "clean-acme"` (or `"bec-acme"`
     for the BEC scenario). For the demo, you may hardcode the seed based
     on which file was dropped.
   - UI subscribes to the SSE stream, mounts six tiles.
   - On `run.init`, render the run header (run id, mandate version, fund).
   - On each `desk.start`, set tile to `streaming`.
   - On each `desk.citation`, append a citation chip to the tile.
   - On each `desk.resolved`, freeze the tile (pass/flag/block) and show
     the headline + facts.
   - On `verdict`:
     - `proceed` → flash the verdict bar green; show "Wire $X queued".
     - `hold` → open the BLOCK modal, prefill `blockingReason` and
       `blockingDesk`. Modal has "Override and amend" + "Cancel".
3. **BLOCK modal → Amendment screen** (BEC demo).
   - GP clicks "Override and amend" with optional rationale.
   - UI calls `POST /api/amend` with the `OverrideContext`.
   - Render the returned `diff` + `prBody`. If `prUrl`, link to it.
4. **Memo screen.** After `memo.ready`, call `GET /api/memo/{runId}` and
   render the IC memo. Findings, verdict, required actions.

The two seeded scenarios are the demo. The smoke script
`backend/scripts/smoke.ts` exercises both end-to-end and is the
authoritative reference for the wire format.

---

## 9. Error handling

The backend has three failure tiers (Backend.md §14):

- **Source fallback (silent).** A live API failed, the desk uses fixture
  data. You'll see `Citation.cached === true` on affected citations.
  Render a small grey "cached" pill so reviewers know.
- **Desk failure.** A desk's logic threw. It still emits `desk.resolved`
  with `status: "flag"`, `confidence: 0.5`, `primary: "could not complete check"`,
  and a citation with `detail: "internal error: ..."`. Just render it like
  any other flag.
- **Orchestrator failure.** An `error` event arrives. The stream closes.
  Show a clean error state with `error.message`; do **not** retry.

`fetch` itself can also fail before a response arrives (network drop,
backend not running). Wrap the run client in `try/catch` and treat it the
same as an `error` event.

---

## 10. Testing the integration

With both servers running:

```bash
# in one terminal
cd backend && npm run dev

# in another
cd front-end && npm run dev
```

To validate the wire format independently of the UI:

```bash
cd backend && npm run smoke
```

The smoke script POSTs both fixture seeds, parses the SSE stream, fetches
the memo, and posts the override — exactly what the UI does. If your UI
is misbehaving, run smoke first to confirm the backend is healthy, then
diff the smoke output against what your UI is receiving.

For ad-hoc curl:

```bash
curl -N -X POST http://localhost:3001/api/run \
  -H 'Content-Type: application/json' \
  -d '{"prompt":"test","files":[],"fixtureSeed":"bec-acme"}'
```

---

## 11. Environment variables (frontend)

Only one knob today:

```dotenv
# front-end/.env.local
NEXT_PUBLIC_BACKEND_URL=http://localhost:3001
```

If you take the rewrite approach in §1, you don't need this — the
frontend can use relative `/api/...` paths.

---

## 12. Quick checklist for the UI build

- [ ] Share `backend/lib/contract.ts` with the frontend (copy / alias / package).
- [ ] Add a typed `api.ts` client with `health()`, `startRun()`, `getMemo()`, `amend()`.
- [ ] Implement the SSE consumer with `fetch` + streaming reader (see §4).
- [ ] Build a `useReducer` over the run state model in §4.
- [ ] Wire `proceed` / `review` / `hold` verdict UX, including the BLOCK modal.
- [ ] Wire the amendment flow (`/api/amend`) and render `diff` + `prBody`.
- [ ] Wire the memo screen (`/api/memo/{runId}`).
- [ ] Surface `Citation.cached` as a small badge.
- [ ] Handle `error` events with a clean terminal state, no retry.
- [ ] Verify against `npm run smoke` output.
