---
# ============================================================
# MANDATE.md — Acme Ventures III
#
# This file is the runtime policy for all autonomous wires.
# The YAML frontmatter is parsed and evaluated by the Mandate
# desk on every diligence run. The prose below is the
# human-readable charter that LPs receive. The two must agree.
#
# Amendments are made via pull request only. Every PR must
# include the override that triggered it (if any) and a
# rationale signed by a Managing Partner.
# ============================================================

fund:
  name:           "Acme Ventures III, L.P."
  size_usd:       150_000_000
  vintage:        2025
  domicile:       "Delaware, USA"
  manager:        "Acme Ventures Management III, LLC"
  fund_life_years:        10
  investing_period_years:  5

# ----- LPA hard limits (cannot be overridden in-app) ----------
lpa:
  single_investment_cap_pct: 10        # max % of fund size in any one company
  follow_on_cap_pct:         15        # incl. all follow-ons in one company
  public_securities_cap_pct: 15        # post-IPO holdings
  reserves_pct:              50        # reserved for follow-ons at fund close
  recycling_allowed:         true
  recycling_window_years:    3
  excluded_sectors:
    - defence
    - weapons
    - tobacco
    - adult_entertainment
    - gambling
    - fossil_fuel_extraction
  excluded_geographies:
    - sanctioned_jurisdictions      # see sanctions.jurisdictions
  conflict_of_interest:
    gp_personal_holdings_disclosed: required
    related_party_transactions:    prohibited

# ----- IC charter (softer, can be amended via PR) -------------
ic_charter:
  stages:        [pre_seed, seed, series_a]
  check_size_usd:
    min:    500_000
    max:  5_000_000
  ownership_target_pct: 8
  ownership_floor_pct:  4              # below this, decline unless strategic
  geographies:   [UK, IE, EU, US, CA]
  sectors:
    - b2b_software
    - fintech
    - ai_infrastructure
    - robotics
    - developer_tools
  thesis: |
    Backing technical founders building category-defining
    infrastructure for the AI-native enterprise. We lead or
    co-lead at pre-seed and seed; we follow strong leads at
    Series A.

# ----- Syndicate quality gates --------------------------------
syndicate_quality:
  tier1_lead_required_above_usd: 2_000_000
  tier1_funds:
    - sequoia
    - benchmark
    - accel
    - index_ventures
    - a16z
    - founders_fund
    - greylock
    - kleiner_perkins
    - lightspeed
  lead_must_have_prior_round_in_sector_count: 3

# ----- Signing matrix -----------------------------------------
signing_matrix:
  - threshold_usd:   500_000
    signers_required: 1
    eligible_roles:   [partner, managing_partner]
  - threshold_usd: 2_000_000
    signers_required: 2
    eligible_roles:   [partner, managing_partner]
  - threshold_usd: 5_000_000
    signers_required: 2
    eligible_roles:   [managing_partner]
    requires_ic_minutes: true

# ----- Wire safety policy (the desk that fires the demo BLOCK)-
wire_safety:
  domain_age_min_days: 30
  domain_edit_distance_block: 2          # blocks lookalike domains
  require_dkim_pass: true
  require_spf_pass: true
  require_phone_confirmation_above_usd: 1_000_000
  require_dual_channel_confirmation_above_usd: 2_000_000
  beneficial_owner_match_required: true
  account_holder_name_match_required: true

# ----- Sanctions & PEP screening ------------------------------
sanctions:
  lists:
    - ofac_sdn
    - eu_consolidated
    - uk_hmt
    - un_consolidated
  pep_screen: true
  jurisdictions:
    - russia
    - belarus
    - iran
    - north_korea
    - syria
    - cuba
    - crimea_donetsk_luhansk

# ----- Calibration thresholds ---------------------------------
# Confidence bands the verdict layer uses to escalate.
calibration:
  auto_proceed_min_confidence: 0.85
  flag_for_review_below:       0.70
  hard_block_on_any:           [sanctions_hit, lpa_breach, bec_pattern]
---

# Mandate — Acme Ventures III

## 1. Charter

Acme Ventures III is a $150M Delaware-domiciled venture fund investing in technical founders building infrastructure for the AI-native enterprise. We lead or co-lead at pre-seed and seed and selectively follow strong tier-1 leads at Series A. Our investing period is five years; the fund's life is ten.

This document is the operative policy for **all autonomous wires** initiated by the Mandate platform on behalf of the fund. It is the source of truth for the runtime; the YAML frontmatter is parsed and evaluated on every diligence run, and the prose below is what limited partners receive in their quarterly compliance pack. The two must agree at all times.

## 2. Investment scope

We invest at pre-seed, seed, and Series A. Cheque sizes range from $500,000 to $5,000,000. Our ownership target is 8% on a fully-diluted basis; we will not write a cheque that buys us less than 4% unless the position is strategic and the deviation is approved in writing by the Managing Partners.

We invest in B2B software, fintech, AI infrastructure, robotics, and developer tools, in the United Kingdom, the European Union, the United States, and Canada. We do not invest in defence, weapons, tobacco, adult entertainment, gambling, or fossil fuel extraction. We do not invest in companies headquartered in or with primary operations in sanctioned jurisdictions (see §6).

## 3. Concentration & reserves

No single company may hold more than 10% of fund size on the initial investment, or more than 15% inclusive of follow-ons. Public-market holdings (post-IPO) are capped at 15% of fund value. At fund close, 50% of committed capital is held in reserve for follow-on investments in existing portfolio companies. Recycling is permitted within the first three years and within the limits of the LPA.

## 4. Syndicate quality

Cheques above $2,000,000 require a tier-1 lead investor as defined in the schedule (Sequoia, Benchmark, Accel, Index, a16z, Founders Fund, Greylock, Kleiner Perkins, Lightspeed). The named lead must have led at least three prior rounds in the sector in question; the Investor desk verifies this against Specter Transactions data.

## 5. Signing matrix

Wires are authorised as follows:

- Up to **$500,000** — one signer (Partner or Managing Partner).
- $500,000 to **$2,000,000** — two signers (Partner or Managing Partner).
- Above **$2,000,000** — two Managing Partner signatures and recorded IC minutes.

The Mandate platform enforces this electronically. Any attempt to wire above a tier without the required signatures is blocked at the orchestrator layer.

## 6. Wire safety policy

The fund has lost zero dollars to wire fraud and intends to keep it that way. The wire safety desk applies the following rules to every outbound wire:

1. The source domain of wire instructions must be at least 30 days old at WHOIS lookup.
2. The source domain must not be within edit distance 2 of the verified company domain (lookalike-domain block).
3. Inbound emails carrying wire instructions must pass DKIM and SPF.
4. Wires above $1,000,000 require out-of-band phone confirmation to a number on file from the most recent term sheet — not a number provided in the wire-instruction email itself.
5. Wires above $2,000,000 require dual-channel confirmation: phone *and* a second email to a separately verified address.
6. The beneficial owner of the receiving account must match the legal entity named in the SPA. The account-holder name must match either the legal entity or its registered DBA.

Any rule failure is a hard block. The wire does not proceed; the GP is notified with the specific rule and the evidence.

## 7. Sanctions & PEP screening

Every receiving entity, its directors, and its UBOs are screened against the OFAC SDN list, the EU consolidated list, the UK HMT list, and the UN consolidated list on every wire. Politically Exposed Person screening is applied to all named founders and beneficial owners. A hit on any list is a hard block requiring counsel review.

## 8. Calibration & escalation

The verdict layer uses calibrated confidence to decide between auto-proceed, flag-for-review, and hard-block. Auto-proceed requires confidence ≥ 0.85 across all desks. Confidence between 0.70 and 0.85 on any desk triggers human review. Confidence below 0.70 on any desk, or any of `[sanctions_hit, lpa_breach, bec_pattern]`, is a hard block regardless of other desks' verdicts.

## 9. Amendment process

This mandate is amended exclusively by pull request against `MANDATE.md`. Every amendment must:

- be opened from a branch named `amend/<short-description>`,
- include the override that triggered it (if any) by run ID,
- include the rationale in the PR description,
- be approved by at least one Managing Partner before merge.

Amendments take effect on the next diligence run after merge. There is no live edit, no admin panel, and no in-app override of the YAML frontmatter. The git history of this file is the audit trail.

---

## Amendment log

| Date       | PR    | Author    | Summary                                                                 |
|------------|-------|-----------|-------------------------------------------------------------------------|
| 2026-04-02 | #14   | A. Patel  | Added `developer_tools` to permitted sectors                            |
| 2026-03-18 | #11   | M. Singh  | Tightened `tier1_lead_required_above_usd` from $2.5M → $2M              |
| 2026-02-09 | #07   | A. Patel  | Added Greylock, Lightspeed to tier-1 list                               |
| 2026-01-22 | #03   | M. Singh  | Initial mandate ratified at fund close                                  |
