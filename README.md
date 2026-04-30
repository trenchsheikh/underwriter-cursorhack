<div align="center">

# UnderWriter

### Autonomous VC Diligence, in 60 Seconds

*A Cursor-driven agent that fans out six diligence desks, streams findings to a Next.js UI in real time, synthesises an IC-grade verdict, and queues a wire — or holds it and proposes a mandate amendment as a pull request.*

[![Cursor SDK](https://img.shields.io/badge/Cursor_SDK-Composer_2-black?style=for-the-badge)](https://cursor.com)
[![Next.js 16](https://img.shields.io/badge/Next.js-16-000?style=for-the-badge&logo=nextdotjs)](https://nextjs.org)
[![React 19](https://img.shields.io/badge/React-19-149eca?style=for-the-badge&logo=react)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178c6?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org)
[![OpenAI](https://img.shields.io/badge/OpenAI-GPT--5.5-412991?style=for-the-badge&logo=openai)](https://openai.com)
[![Specter](https://img.shields.io/badge/Specter-MCP-6e56cf?style=for-the-badge)](https://tryspecter.com)

</div>

---

## The pitch in one paragraph

A GP types: *"Wire $2M to Acme Robotics for their Series A. Lead is Sequoia. 50% pro-rata of our $4M allocation."*
UnderWriter parses the prompt and SPA, fans **six concurrent diligence desks** out across Specter, Companies House, OpenSanctions, WHOIS and the fund's own `MANDATE.md`, streams every citation to the UI as it lands, and either **queues the wire** or **fires a BLOCK** — catching, for example, a one-letter typo (`acrne.co` vs `acme.co`) on a forged wire-instruction email registered six days ago with a failing DKIM signature. When the verdict is HOLD, a Cursor SDK Composer-2 agent drafts a pull request that amends the mandate so the same pattern can never slip through again. **The fund's playbook compounds in git.**

> **The demo catches a $2M Business Email Compromise in 60 seconds** that a junior associate would have wired.

The Specter integration follows [`backend/docs/SPECTER_FLOW.md`](./backend/docs/SPECTER_FLOW.md) end-to-end — `POST /companies` → `GET /companies/{id}/people` → `GET /people/{id}` → `GET /companies/{id}/similar`, the §3b derived fields (`prior_exits`, `stealth_history`, `departed_subject_company`), and the §4 cross-step underwriting flags (`founder_departed_before_close`, `ex_founder_now_at_investor`, `funding_outlier_high|low`). The canonical worked example — Dex (`meetdex.ai`) closing a $5.3M Seed led by a16z with a co-founder who exited 26 days before close and now scouts for the lead — ships as a third demo seed (`dex-meetdex`).

---

## Why this matters

| Problem | UnderWriter's answer |
| --- | --- |
| BEC scams cost the industry **$2.7B/year** ([FBI IC3 2023](https://www.ic3.gov/AnnualReport/Reports/2023_IC3Report.pdf)) | A dedicated **Wire Safety desk** runs WHOIS + Levenshtein + DKIM + sanctions screening on every wire |
| Diligence is a 2-week analyst slog of 30 browser tabs | **Six desks in parallel**, joined at a single verdict, in under 30 seconds |
| Every fund has a mandate; nobody reads it | The mandate **is the agent's source code** — pure rule evaluation, deterministic, auditable |
| Policy drifts; institutional knowledge evaporates | Every override drafts a **PR against `MANDATE.md`** with rationale and run reference |

---

## Technology stack

<table>
  <thead>
    <tr><th>Layer</th><th>Technology</th><th>Why</th></tr>
  </thead>
  <tbody>
    <tr><td rowspan="3"><b>Agent runtime</b></td><td>Cursor SDK · Composer 2</td><td>Sandboxed cloud VMs, parallel subagents, MCP tooling, file-editing for amendment PRs</td></tr>
    <tr><td>OpenAI GPT-5.5</td><td>Structured prompt parsing, SPA/wire extraction, memo editorial summary (Zod-validated)</td></tr>
    <tr><td>MCP (Model Context Protocol)</td><td>Specter, Companies House, OpenSanctions, WHOIS exposed as tools</td></tr>
    <tr><td rowspan="3"><b>Backend</b></td><td>Next.js 16 Route Handlers</td><td>Single runtime for HTTP + SSE; zero ops surface area</td></tr>
    <tr><td>React 19 · TypeScript 5</td><td>End-to-end type safety from <code>RunEvent</code> at the seam</td></tr>
    <tr><td>Server-Sent Events (SSE)</td><td>Live streaming of <code>desk.start</code> / <code>desk.citation</code> / <code>desk.resolved</code> / <code>verdict</code></td></tr>
    <tr><td rowspan="3"><b>Data sources</b></td><td>Specter (companies, people, transactions, interest signals)</td><td>The unique data — who's <i>actually</i> leading the round in the last 60 days</td></tr>
    <tr><td>Companies House · OpenSanctions · WHOIS</td><td>Registry truth, sanctions/PEP screening, domain provenance</td></tr>
    <tr><td>PDF / EML parsing (<code>pdf-parse</code>, <code>mailauth</code>)</td><td>SPA extraction; SPF / DKIM / DMARC verification on inbound wire emails</td></tr>
    <tr><td rowspan="2"><b>Frontend</b></td><td>Next.js 16 App Router · React 19</td><td>Mandate / Run / Memo screens; SSE consumer renders tiles in real time</td></tr>
    <tr><td>CSS variables + dark/light theme</td><td>Fixed-width memo template that looks like a real fund document</td></tr>
    <tr><td><b>Validation</b></td><td>Zod</td><td>Every LLM output is schema-checked before it touches the verdict layer</td></tr>
    <tr><td><b>Mandate</b></td><td><code>gray-matter</code> (YAML frontmatter) + Markdown</td><td>The policy file <i>is</i> the source of truth — readable by LPs, executable by the agent</td></tr>
    <tr><td><b>Resilience</b></td><td>In-memory cache + fixture fallback per source</td><td><code>DEMO_FORCE_FIXTURES=true</code> = on-stage panic button</td></tr>
    <tr><td><b>Mock rails</b></td><td>In-process wire ledger</td><td>No real money moves; every run is a queued / held entry</td></tr>
  </tbody>
</table>

---

## System architecture

```mermaid
flowchart TB
    subgraph User["GP — Browser"]
        UI["Next.js 16 UI<br/>Mandate · Run · Memo"]
    end

    subgraph Backend["Next.js 16 Route Handlers · port 3001"]
        RUN["POST /api/run<br/>SSE stream"]
        MEMO["GET /api/memo/:runId"]
        AMEND["POST /api/amend"]
        ORCH(["Orchestrator<br/>agents/orchestrator.ts"])
        SYN(["Synthesise<br/>findings → verdict"])
        MEMOGEN(["Memo generator"])
        LEDGER[("Mock wire ledger")]
    end

    subgraph Desks["Six diligence desks (parallel)"]
        D1["01 Company"]
        D2["02 Founder"]
        D3["03 Lead investor"]
        D4["04 Round dynamics"]
        D5["05 Mandate"]
        D6["06 Wire safety"]
    end

    subgraph Sources["Data sources (each w/ fixture fallback)"]
        SPEC["Specter MCP"]
        CH["Companies House"]
        OS["OpenSanctions"]
        WH["WHOIS / DNS / DKIM"]
        MD[("MANDATE.md<br/>YAML + prose")]
        OAI["OpenAI GPT-5.5"]
    end

    subgraph Cursor["Cursor SDK · Composer 2"]
        AMENDER["Amendment drafter"]
        PR[("GitHub PR<br/>against MANDATE.md")]
    end

    UI -- "POST /api/run" --> RUN
    RUN --> ORCH
    ORCH --> D1 & D2 & D3 & D4 & D5 & D6
    D1 -. "tools" .-> SPEC
    D1 -. "tools" .-> CH
    D2 -. "tools" .-> SPEC
    D2 -. "tools" .-> OS
    D3 -. "tools" .-> SPEC
    D4 -. "tools" .-> SPEC
    D4 -. "GPT-5.5 SPA parse" .-> OAI
    D5 -. "rules" .-> MD
    D6 -. "tools" .-> WH
    D6 -. "tools" .-> OS
    D6 -. "tools" .-> CH

    D1 & D2 & D3 & D4 & D5 & D6 -- "DeskFinding" --> SYN
    SYN --> MEMOGEN
    MEMOGEN -. "editorial summary" .-> OAI
    SYN -- "PROCEED" --> LEDGER
    SYN -- "HOLD" --> AMEND

    AMEND --> AMENDER
    AMENDER --> PR

    ORCH -. "RunEvent SSE" .-> UI
    UI -- "GET /api/memo/:runId" --> MEMO
    UI -- "POST /api/amend" --> AMEND

    classDef tile fill:#0b0b0b,stroke:#666,stroke-width:1px,color:#eee
    class D1,D2,D3,D4,D5,D6 tile
```

---

## The diligence run, end to end

```mermaid
sequenceDiagram
    autonumber
    participant GP as GP
    participant UI as Next.js UI
    participant API as /api/run
    participant Orch as Orchestrator
    participant Desks as 6× Desks (parallel)
    participant Ext as Specter / CH / OS / WHOIS
    participant LLM as OpenAI GPT-5.5
    participant Mem as Memo store

    GP->>UI: prompt + SPA + wire instructions
    UI->>API: POST /api/run (RunRequest)
    API-->>UI: 200 OK · text/event-stream
    API->>Orch: runOrchestrator(req, send)
    Orch->>LLM: parsePrompt(prompt) → ParsedDeal
    Orch->>Orch: loadMandate() (gray-matter)
    Orch-->>UI: run.init { runId, mandateVersion }

    par Six desks fan out (Promise.allSettled)
        Orch->>Desks: company
        Desks->>Ext: Specter + Companies House
        Desks-->>UI: desk.start · desk.citation… · desk.resolved
    and
        Orch->>Desks: founder
        Desks->>Ext: Specter + OpenSanctions PEP
        Desks-->>UI: desk.start · desk.citation… · desk.resolved
    and
        Orch->>Desks: investor
        Desks->>Ext: Specter Interest Signals
        Desks-->>UI: desk.start · desk.citation… · desk.resolved
    and
        Orch->>Desks: round
        Desks->>LLM: parseSPA() (Zod-validated)
        Desks->>Ext: Specter Transactions (comparables)
        Desks-->>UI: desk.start · desk.citation… · desk.resolved
    and
        Orch->>Desks: mandate (pure code, no LLM)
        Desks-->>UI: desk.start · desk.citation… · desk.resolved
    and
        Orch->>Desks: wire-safety
        Desks->>Ext: WHOIS + DKIM + Levenshtein + sanctions
        Desks-->>UI: desk.start · desk.citation… · desk.resolved
    end

    Orch->>Orch: synthesise(findings) → Verdict
    Orch-->>UI: verdict { action, confidence, blockingDesk? }
    Orch->>LLM: editorial summary (memo lede)
    Orch->>Mem: saveMemo(runId, MemoData)
    Orch-->>UI: memo.ready { memoId }

    alt verdict.action = proceed
        UI->>GP: green PROCEED bar · "Generate IC Memo"
    else verdict.action = hold
        UI->>GP: red BLOCK modal with reason + clause
        GP->>UI: click "Override & amend"
        UI->>API: POST /api/amend (OverrideContext)
        API->>LLM: Composer 2 drafts MANDATE.md diff
        API-->>UI: AmendmentDraft { branch, diff, prTitle, prBody }
        UI->>GP: PR preview + rationale
    end
```

---

## The six desks at a glance

```mermaid
flowchart LR
    subgraph Inputs
        P["Prompt"]
        SPA["SPA PDF"]
        WI["Wire .pdf / .eml"]
    end

    subgraph D["Six desks · concurrent · 30s timeout each"]
        D1["<b>01 Company</b><br/>Entity exists,<br/>active, on-script<br/><i>Specter · CH</i>"]
        D2["<b>02 Founder</b><br/>Real people,<br/>no PEP / sanctions<br/><i>Specter · OS</i>"]
        D3["<b>03 Lead investor</b><br/>Lead is <i>actually</i> leading<br/>in last 60 days<br/><i>Specter signals</i>"]
        D4["<b>04 Round dynamics</b><br/>Size, valuation,<br/>pro-rata math<br/><i>Specter · GPT-5.5</i>"]
        D5["<b>05 Mandate</b><br/>LPA · IC · signing<br/>matrix · pure code<br/><i>MANDATE.md</i>"]
        D6["<b>06 Wire safety</b><br/>BEC · shell · sanctions<br/><i>WHOIS · DKIM · OS · CH</i>"]
    end

    V{{Verdict layer<br/>any block ⇒ HOLD<br/>any flag ⇒ REVIEW<br/>else PROCEED}}

    P --> D1 & D2 & D3 & D4 & D5
    SPA --> D4
    WI --> D6
    D1 & D2 & D3 & D4 & D5 & D6 --> V
    V --> M["IC Memo<br/>(deterministic + LLM lede)"]
    V -- proceed --> L["Mock wire ledger"]
    V -- hold --> A["Amendment PR<br/>(Cursor Composer 2)"]
```

Each desk emits its own `desk.start` → `desk.citation*` → `desk.resolved` event sequence. The orchestrator never blocks on the slowest desk — `Promise.allSettled` plus a 30-second per-desk hard timeout guarantees the verdict layer always runs.

---

## The amendment loop — the agent edits the agent

```mermaid
flowchart LR
    BLOCK["Wire-safety BLOCK<br/>e.g. lookalike acrne.co"]
    OVR["GP clicks<br/>'Override & amend'"]
    OCTX[("OverrideContext<br/>+ runId + clause")]
    COMP["Cursor SDK<br/>Composer 2"]
    MD[("MANDATE.md")]
    DIFF["Unified diff<br/>+ rationale paragraph"]
    PR["Draft PR<br/>(Octokit · optional)"]
    REVIEW["Managing partner<br/>reviews like code"]
    MERGE[("Mandate v + 1<br/>future runs enforce<br/>the new clause")]

    BLOCK --> OVR --> OCTX --> COMP
    MD --> COMP
    COMP --> DIFF --> PR --> REVIEW --> MERGE
    MERGE -. enforced by Desk 05 .-> BLOCK
```

> Every override is a learning event. The mandate becomes the fund's compounding moat — versioned, reviewed, merged.

---

## Quick start

The backend runs end-to-end against fixtures with **zero API keys** required.

```bash
# Backend (port 3001)
cd backend
npm install
npm run dev
```

In a second terminal — the smoke driver POSTs both seeded scenarios to `/api/run`, prints the streaming desk events, fetches the memo, and draws the amendment-PR draft for the BEC run:

```bash
cd backend
npm run smoke
```

Frontend (port 3000):

```bash
cd front-end
npm install
npm run dev
```

Then open <http://localhost:3000>.

---

## Backend API

All endpoints are versionless and consumed by the UI over HTTP.

| Method | Path | Description |
| ------ | ---- | ----------- |
| `GET`  | `/api/health`        | Liveness probe |
| `POST` | `/api/run`           | Start a diligence run; streams `RunEvent` lines as SSE (`text/event-stream`) |
| `GET`  | `/api/memo/{runId}`  | Returns `MemoData` for a completed run |
| `POST` | `/api/amend`         | Drafts an amendment PR from an `OverrideContext` |

The full SSE event schema lives in [`backend/lib/contract.ts`](./backend/lib/contract.ts) — a single source of truth shared by backend and UI.

<details>
<summary><b>Curl smoke (click to expand)</b></summary>

```bash
# Health
curl -s http://localhost:3001/api/health

# Streaming run — clean Acme (expected verdict: PROCEED, 6/6 desks pass)
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

# Streaming run — SPECTER_FLOW canonical Dex deal (expected verdict: REVIEW)
curl -N -X POST http://localhost:3001/api/run \
  -H 'Content-Type: application/json' \
  -d '{
    "prompt": "Wire $2,650,000 to Dex for their Seed. Lead is Andreessen Horowitz. 50% pro-rata of our $5,300,000 allocation.",
    "files": [
      {"name":"dex_spa.pdf","mime":"application/pdf","size":0,"ref":"spa"},
      {"name":"wire_instructions_clean.pdf","mime":"application/pdf","size":0,"ref":"wi-clean"}
    ],
    "fixtureSeed": "dex-meetdex"
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

</details>

---

## Demo scenarios

The demo ships with two seeded buttons — one contrast, one story.

| Scenario | Verdict | What the audience sees |
| --- | --- | --- |
| 🟢 **Clean Acme deal** | `PROCEED` · 6/6 desks pass | Tiles light up green over ~30 s · IC memo renders · wire queues |
| 🔴 **BEC Acme deal** | `HOLD` · Wire desk BLOCK | Five tiles green; **Wire safety** lands red with: lookalike domain (`acrne.co` ↔ `acme.co`, edit distance 1), domain age 6 days, DKIM fail, beneficial-owner mismatch · BLOCK modal cites `wire_safety §6.2` · GP clicks **Override & amend** → Cursor Composer 2 drafts a `MANDATE.md` PR |
| 🟡 **Dex (`meetdex.ai`)** | `REVIEW` · Founder desk flag | Five tiles green; **Founder desk** turns yellow with two SPECTER_FLOW.md §4 flags surfaced: `founder_departed_before_close` (Harry Uglow exited 26 days before the Seed close) and `ex_founder_now_at_investor` (his current tagline references "a16z speedrun scout", a listed investor). Verdict is REVIEW — the data does not block the deal, but the AI underwriter has surfaced what a human reader might miss. |

Set `DEMO_FORCE_FIXTURES=true` to skip every live API and serve from `backend/fixtures/`. **The on-stage panic button.**

---

## Project layout

```
underwriter-cursorhack/
├── backend/                          # Next.js 16 Route Handlers (port 3001)
│   ├── app/api/
│   │   ├── run/route.ts              # POST · SSE stream of RunEvent
│   │   ├── memo/[runId]/route.ts     # GET · MemoData
│   │   ├── amend/route.ts            # POST · AmendmentDraft (Composer 2)
│   │   └── health/route.ts
│   ├── agents/
│   │   ├── orchestrator.ts           # fans out 6 desks, joins at verdict
│   │   ├── parse-prompt.ts           # GPT-5.5 → ParsedDeal (Zod)
│   │   ├── synthesise.ts             # findings → verdict (pure)
│   │   ├── memo.ts                   # findings + verdict → MemoData
│   │   ├── amend.ts                  # override → AmendmentDraft
│   │   └── desks/                    # company · founder · investor
│   │                                 # round · mandate · wire-safety
│   ├── lib/
│   │   ├── contract.ts               # ⭐ THE SEAM — shared types
│   │   ├── mandate-loader.ts         # gray-matter on MANDATE.md
│   │   ├── mandate-evaluator.ts      # pure rule evaluation (no LLM)
│   │   ├── ledger.ts                 # mock wire ledger
│   │   ├── cache.ts                  # in-memory + fixture fallback
│   │   └── sources/                  # specter (SPECTER_FLOW.md impl)
│   │                                 # companies-house · opensanctions
│   │                                 # whois · pdf-parse · llm
│   ├── fixtures/
│   │   └── specter/snapshots/        # canonical SpecterSnapshot fixtures
│   │                                 # (dex.json, acme.json)
│   ├── MANDATE.md                    # the policy file the agent runs against
│   └── docs/                         # Backend.md · ARCHITECTURE.md · DEMO.md
└── front-end/                        # Next.js 16 UI (port 3000)
    └── app/
        ├── components/               # MandateScreen · RunScreen · MemoScreen
        │                             # DeskTile · VerdictBar · BlockModal
        │                             # AmendmentPR · CreatePRModal
        └── state/                    # types · initial · fixtures
```

---

## Configuration

All external APIs are **optional** — the backend defaults to fixtures and runs cleanly with zero keys. See [`backend/.env.example`](./backend/.env.example) for the complete list (Cursor SDK, OpenAI, Specter, Companies House, OpenSanctions, WHOIS, GitHub).

```bash
DEMO_FORCE_FIXTURES=true   # bypass every live API — on-stage panic button
DEMO_GITHUB_REPO=          # if set, amendments open real PRs via Octokit
```

---

## Design principles

1. **The mandate is the spine.** Every decision is grounded in `MANDATE.md`. No agent has authority outside what the mandate grants. Overrides become amendments via PR.
2. **Six desks, parallel by default.** Each desk is a single-purpose subagent with one job, one data-source family, one output shape. They don't talk to each other — they join at the verdict step.
3. **Load-bearing data, not decorative.** Every desk has a primary source it cannot function without. If the source is down, the desk reports degraded confidence rather than fabricating.
4. **Calibrated escalation.** Desks don't say "looks fine." They say *PASS, confidence 0.94, basis: [Specter ID, Companies House filing, comparable round]*. The verdict layer treats confidence as input, not noise.
5. **The agent edits the agent.** Every override drafts an amendment PR. The fund's playbook compounds in git.
6. **Honest failure.** Three tiers (graceful degradation → desk-level flag → orchestrator error). Citations carry `cached: true` when fixtures fired. **We never fabricate a finding. We never silently omit a desk.**

---

## What this deliberately does *not* do

No real money movement (mock ledger only) · no email sending (drafts only) · no authentication (single-tenant demo) · no run persistence beyond process memory · no automatic retries (one shot, then fixture) · no PII logging.

---

## Credits

Built for the **Cursor Hackathon**. Thanks to:

- **[Cursor](https://cursor.com)** — the SDK, Composer 2, and the cloud sandboxes that make subagents real
- **[Specter](https://tryspecter.com)** — the load-bearing dataset for company, founder, investor, and round-dynamics desks
- **OpenAI · Companies House · OpenSanctions** — the rest of the data spine

---

<div align="center">
<sub><b>UnderWriter</b> — your fund's policy, executed.</sub>
</div>
