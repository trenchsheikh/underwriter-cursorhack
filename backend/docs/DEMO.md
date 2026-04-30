# Demo

90-second stage script. Practiced twice before the demo. Two prompts pre-loaded as buttons. Optimised for the screenshot that survives.

## Stage setup before you click anything

1. App is open at the **Diligence Run** screen with two buttons visible:
   - 🟢 **Clean Acme deal**
   - 🔴 **BEC Acme deal**
2. The mandate page is one tab over; you can flick to it for the opening line.
3. Six tile placeholders sit in a 3×2 grid in the centre of the screen, greyed out, ready to stream.
4. Specter status indicator is green. If it's red, switch the build flag to `cached fixtures` and tell the audience plainly — it's more credible than a panicked retry.

## Scene 1 — The Mandate (10 seconds)

Open the file `MANDATE.md` in the side panel. Don't scroll. Just say:

> "This is our fund's mandate — LPA terms, IC charter, signing matrix, wire safety rules. The YAML at the top is what the agent evaluates against at runtime. The prose is what the LPs read. Every change to this file is a pull request."

Click back to the Diligence Run tab.

## Scene 2 — The Trigger (15 seconds)

Click 🟢 **Clean Acme deal**. The prompt populates:

> *"Wire $2M to Acme Robotics for their Series A. Lead is Sequoia. 50% pro-rata of our $4M allocation. SPA and wire instructions attached."*

Two file thumbnails appear: `acme_spa.pdf` and `wire_instructions_clean.pdf`.

Hit **Run Diligence**. Say:

> "Six desks fan out in parallel. Each one is a Cursor SDK subagent in its own sandboxed VM. Watch them resolve."

## Scene 3 — The Six Desks (45 seconds, the spectacle)

The tiles light up and stream. They resolve at staggered times — design this in the demo, don't fight it. Suggested order and timing:

| ~T+ | Desk           | Status | One-liner shown |
|-----|----------------|--------|-----------------|
| 5s  | Mandate        | ✓      | 8/8 rules pass; $2M within tier, sector permitted |
| 8s  | Round dynamics | ✓      | $18M @ $80M post — within EU robotics A median |
| 12s | Founder        | ✓      | Sarah Chen, ex-Boston Dynamics, prior exit ABB 2019 |
| 16s | Company        | ✓      | Acme Robotics Ltd, inc. 2021, 47 FTE, last round Index |
| 22s | Lead investor  | ✓      | 4 Sequoia partner engagements in last 60 days |
| 30s | Wire safety    | ✓      | Domain age 1,847d, DKIM ✓, beneficial owner match |

Each tile shows two or three Specter / Companies House / OpenSanctions citation chips. The verdict bar at the bottom turns green: **PROCEED**.

A "Generate IC Memo" button appears. Click it. The memo renders in the right panel — clean, one page, fixed-width, looks like a real fund document. Say:

> "Sixty seconds. Six data sources. Memo is signed and ready for the partner. Wire is queued."

This is the **first screenshot moment.** Do not skip giving the audience two seconds to read the memo.

## Scene 4 — The Block (20 seconds, the wow)

Click 🔴 **BEC Acme deal**. Prompt and files repopulate. Look identical to the audience.

> "Same deal. Watch the wire safety desk."

Hit **Run Diligence**. The first five desks all turn green at roughly the same cadence. Then the wire safety desk lands red:

```
⚠ BLOCK — Business Email Compromise pattern

  Wire instructions email originated from: founder@acrne.co
  Verified company domain:                  acme.co
  Edit distance:                            1
  acrne.co WHOIS registration:              2026-04-24  (6 days ago)
  DKIM on inbound email:                    fail
  Mandate clause invoked:                   wire_safety §6.2

  Recommended action: HOLD
  Required: out-of-band phone confirmation to number from SPA (§6.4)
```

Hold the silence for two seconds. Then:

> "Five desks said yes. A junior would have wired it. This is the $2.7B/year BEC problem — caught here, in 60 seconds, because the policy is enforced and the data is load-bearing."

## Scene 5 — The Amendment (15 seconds, the structural moment)

A new button appears: **"Propose mandate amendment."** Click it.

A diff view opens showing the agent's proposed addition to `MANDATE.md`:

```diff
   wire_safety:
     domain_age_min_days: 30
     domain_edit_distance_block: 2
+    blocked_domains_seen_in_attacks:
+      - acrne.co        # added 2026-04-30 from run 8a3f
+    require_phone_confirmation_above_usd: 1_000_000
```

Below it: "PR #19 opened by Mandate agent. Awaiting Managing Partner review."

Say:

> "The agent has proposed an amendment to its own policy. The Managing Partners review it like code. If they merge, every future wire is checked against this rule. The fund's playbook compounds in git."

## Scene 6 — The Memo (5 seconds, the artifact)

Show the BLOCK memo briefly. Same template as the clean one, but with a red banner: **HOLD — DO NOT WIRE**. Three-line summary at the top, full reasoning below, all citations live.

> "This is what survives. The memo, the diff, the git history."

This is the **second screenshot moment** — and the one you post on X.

## Closing line (5 seconds)

> "Mandate. Your fund's policy, executed. Built on Cursor SDK, Specter, and OpenAI. We caught a 1-letter typo that would have moved $2M. Thank you."

---

## What you do *not* do on stage

- **Do not** send any email live. Show drafts in the memo. Do not click "send".
- **Do not** type the prompts live. Buttons only. One typo on stage and you lose ten seconds.
- **Do not** explain the architecture during the run. The architecture is in the README. The demo is a movie.
- **Do not** apologise for the mock ledger. Say "mock rails for the demo" once if asked. Move on.
- **Do not** run a third deal. Two deals, one contrast. Three is greedy and you'll run out of time.

## What you carry off stage

- The clean PASS memo — for the X post.
- The BLOCK memo with the BEC explanation — for the X post.
- The amendment PR diff — for the X post.

Three images. Same colour palette. Same fixed-width memo template. Tight thread. Every founder in the audience reposts at least one.

## Recovery plays

- **Specter goes down mid-run.** UI shows `cached @ HH:MM` on the affected tiles. Say "we're seeing some Specter rate-limiting; the fixtures are from a real run earlier today." Move on.
- **A desk hangs > 45 seconds.** Wait. Don't fidget. The streaming is the spectacle; latency is fine if you act calm. If it truly stalls, click "Re-run desk" — the desks are independent.
- **A tile resolves in the wrong order and steps on your patter.** Adapt. The order doesn't matter; the wire-safety desk landing last is the only sequence that matters.
- **The amendment PR doesn't render.** Have the screenshot ready as a fallback slide. Show it.
