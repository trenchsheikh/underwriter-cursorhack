# Data Sources

Practical lookup. Per desk, the primary source, the specific endpoints we hit, what we extract, and what we do when something is rate-limited or down.

---

## Specter (the spine — bonus bucket)

Used by four of the six desks. Without it, the project doesn't make its case for "Best use of Specter." Get access on Discord from Francisco before anything else.

**Auth.** API key in `Authorization: Bearer …` header. Set `SPECTER_API_KEY` in `.env`. Their MCP server can be wired straight into the Cursor SDK harness via `.cursor/mcp.json`.

**Endpoints we use.**

| Desk | Endpoint | Extracts |
|------|----------|----------|
| Company  | `POST /enrichment/companies` (by domain) | Founded year, headcount, revenue signals, last round, news, web traffic |
| Company  | `GET  /companies/{id}/people`            | Current team, key hires |
| Founder  | `POST /enrichment/people` (by name+co)   | Employment history, education, prior companies, exits, stealth flags |
| Founder  | `GET  /people/{id}/email`                | Verified email address (used only as cross-reference, never for outreach during the demo) |
| Investor | `GET  /investor-interest/{co_id}`        | Interest signals — partner engagements, recency, source signals |
| Investor | `GET  /investor-interest/searches/...`   | Recency window filtered to last 60 days for the named lead |
| Round    | `POST /entities/text-search`             | Comparable transactions: same sector + stage + geography + 12-month window |

**Fallback.** If Specter is rate-limited or down: every demo run uses the seeded `Acme Robotics` fixture stored in `fixtures/specter/acme.json`. The UI labels these tiles `cached @ HH:MM` rather than pretending to be live. Honesty beats fragility on stage.

**Quota planning.** Reserve enough credits for ~50 runs during build + 5 runs at the demo (rehearsals + live). Cache aggressively in `redis` keyed by `(endpoint, payload_hash)` with a 24h TTL. Don't hit Specter from the UI — only from the orchestrator.

---

## Companies House (UK) / OpenCorporates (global)

For legal entity verification. Free, fast, no auth dance for Companies House.

**Companies House — `https://api.company-information.service.gov.uk`.** Free, register for an API key in 2 minutes.

| Endpoint | Use |
|----------|-----|
| `GET /search/companies?q=…` | Resolve company name → company number |
| `GET /company/{number}` | Status (active / dissolved / liquidation), incorporation date, registered office, SIC codes |
| `GET /company/{number}/officers` | Directors and secretaries |
| `GET /company/{number}/persons-with-significant-control` | Beneficial ownership — used by wire-safety desk |
| `GET /company/{number}/filing-history` | Recent filings (used to flag dormant / non-trading status) |

**OpenCorporates — `https://api.opencorporates.com/v0.4`.** Use for non-UK entities. Free tier rate-limited; sponsor-style demos usually fit comfortably.

**Fallback.** Cached fixtures keyed by company number. The seeded `Acme Robotics Ltd` is `13427891` (fictional but well-formed).

---

## OpenSanctions

Sanctions and PEP screening. Free, fast, comprehensive. `https://api.opensanctions.org`.

| Endpoint | Use |
|----------|-----|
| `GET /match/default` (POST a name + jurisdiction) | OFAC SDN, EU consolidated, UK HMT, UN, plus PEP databases |
| `GET /search/default?q=…` | Free-text search when entity ID isn't known |

**What we screen.** The receiving entity, every named director from Companies House, every named founder from the prompt, and every UBO with > 25% control.

**Fallback.** OpenSanctions has bulk dataset downloads — pull a snapshot to `fixtures/opensanctions/` once at build time and use that as the offline matcher. Live API for the demo, cache as backup.

---

## WHOIS / DNS (the BEC catch)

This is the desk that fires the BLOCK in the demo. All free, all standard libraries.

**WHOIS.** Use the `whois` npm package or `node-whois`. We need the **registration date** of the source domain on the wire-instruction email.

```ts
import whois from 'whois-json';
const r = await whois('acrne.co');
const ageDays = (Date.now() - new Date(r.creationDate).getTime()) / 86400000;
```

**DNS.** Built-in Node `dns/promises`. We need MX records (does the domain accept email at all?), and we need to verify SPF and DKIM on the inbound wire-instruction email.

**Levenshtein.** Compare source domain to the verified company domain. Use `fast-levenshtein` or hand-roll — it's 20 lines.

**SPF / DKIM.** `mailauth` package validates both against the raw email. The wire-instruction email is uploaded as `.eml` for the demo so we can show this on a tile.

**Fallback.** WHOIS is occasionally flaky. Pre-cache `acme.co` and `acrne.co` lookups in fixtures. Live demo runs the cached path if WHOIS times out > 3 seconds.

---

## SPA / wire-instruction parsing

PDFs uploaded by the GP. Two parses:

**SPA — extracts terms.** Send the PDF to Composer 2 (or GPT-5.5 via OpenAI) with a structured-output prompt: `valuation_post_money`, `round_size`, `lead_investor`, `pro_rata_right_pct`, `liquidation_preference`, `board_composition`. Cross-checked against the GP's prompt — discrepancies flag.

**Wire instructions — extracts banking.** Same pattern: `bank_name`, `account_holder`, `account_number_masked`, `swift`, `source_email_domain`. The source email domain is what the wire-safety desk runs WHOIS against.

**Fallback.** The two demo PDFs (`acme_spa.pdf`, `wire_instructions_clean.pdf`, `wire_instructions_bec.pdf`) are pre-parsed and stored in fixtures. If the LLM call hangs at demo time, the orchestrator uses the fixture. Don't re-parse on every run.

---

## Modern Treasury (or mock ledger)

For the wire rails. Three options ranked by ambition:

**Mock.** A 50-line in-memory ledger that emits an event when a wire is queued. Logs `WIRE QUEUED` to the UI. This is enough for the demo.

**Modern Treasury sandbox.** Real-looking webhook events, a real-looking ledger UI link. Adds polish if you have spare time and an account. `https://app.moderntreasury.com/sandbox`.

**Increase / Stripe Treasury.** Don't bother. Too much KYC, no demo upside.

For the hackathon, pick mock. Wire the event into the UI as a small "queued" badge after a clean PASS. Don't actually move money.

---

## OpenAI (Composer 2 fallback / bonus bucket)

Composer 2 is the default reasoning model via the Cursor SDK. For the **memo synthesis** and the **thesis-fit reasoning** in the Mandate desk, we route to GPT-5.5 via the OpenAI API directly, structured-output mode. This is what we point at when claiming the LLM bonus.

**Why two models, not one.** Composer 2 is excellent at agentic tool-using work (the desks). GPT-5.5 is excellent at long-context structured synthesis (the memo). Picking the right model per task is itself part of the "Best use of LLM" pitch.

---

## What we explicitly don't use

- **LinkedIn API.** Restricted, slow approval, not worth it. Specter People covers this dimension.
- **Crunchbase / PitchBook.** Specter is the bonus bucket; using a competitor data source dilutes the pitch.
- **Plaid / Open Banking.** No fund-side bank connection in 12 hours. Mock the ledger.
- **Email sending.** Drafts only in the memo. The agent does not autonomously contact third parties in the live demo.

---

## .env template

```dotenv
# Cursor SDK
CURSOR_API_KEY=

# Specter
SPECTER_API_KEY=
SPECTER_MCP_URL=https://mcp.tryspecter.com

# Companies House
COMPANIES_HOUSE_API_KEY=

# OpenSanctions (no key required for hosted; key for higher rate limits)
OPENSANCTIONS_API_KEY=

# OpenAI (for memo synthesis + thesis reasoning)
OPENAI_API_KEY=

# Modern Treasury (optional)
MODERN_TREASURY_API_KEY=
MODERN_TREASURY_ORG_ID=
```

---

## Cursor `.cursor/mcp.json`

```json
{
  "mcpServers": {
    "specter": {
      "url": "https://mcp.tryspecter.com",
      "headers": { "Authorization": "Bearer ${SPECTER_API_KEY}" }
    },
    "companies-house": {
      "command": "npx",
      "args": ["-y", "@mandate/mcp-companies-house"],
      "env": { "COMPANIES_HOUSE_API_KEY": "${COMPANIES_HOUSE_API_KEY}" }
    },
    "opensanctions": {
      "command": "npx",
      "args": ["-y", "@mandate/mcp-opensanctions"]
    },
    "whois": {
      "command": "npx",
      "args": ["-y", "@mandate/mcp-whois"]
    }
  }
}
```

The `@mandate/*` MCP servers above are 30-line wrappers each — write them as you build. They expose the relevant endpoints as tools the SDK subagents can call.
