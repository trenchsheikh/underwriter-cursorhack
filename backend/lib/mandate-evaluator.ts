/**
 * Pure rule evaluation. No I/O, no LLM. Each function returns a {pass, clause, detail}.
 *
 * Rules are grouped by section. The Mandate desk runs every rule and emits
 * one citation per rule.
 */

import type { FundState, Mandate, ParsedDeal, RuleResult } from "./types";

const fmtUsd = (n: number) => `$${n.toLocaleString("en-US")}`;

// ---------- LPA hard limits ----------

export function checkSingleInvestmentCap(
  m: Mandate,
  d: ParsedDeal,
  s: FundState,
): RuleResult {
  const cap = (m.lpa.singleInvestmentCapPct / 100) * m.fund.sizeUsd;
  const exposureAfter = (s.positions[d.company.companyId] ?? 0) + d.amountUsd;
  return {
    pass: exposureAfter <= cap,
    clause: "lpa.single_investment_cap_pct",
    sectionRef: "LPA §3",
    detail: `Exposure after this round: ${fmtUsd(exposureAfter)}; cap: ${fmtUsd(cap)} (${m.lpa.singleInvestmentCapPct}% of fund).`,
  };
}

export function checkFollowOnCap(
  m: Mandate,
  d: ParsedDeal,
  s: FundState,
): RuleResult {
  const cap = (m.lpa.followOnCapPct / 100) * m.fund.sizeUsd;
  const exposureAfter = (s.positions[d.company.companyId] ?? 0) + d.amountUsd;
  return {
    pass: exposureAfter <= cap,
    clause: "lpa.follow_on_cap_pct",
    sectionRef: "LPA §3",
    detail: `Inclusive exposure after this round: ${fmtUsd(exposureAfter)}; follow-on cap: ${fmtUsd(cap)}.`,
  };
}

export function checkSectorAllowed(m: Mandate, d: ParsedDeal): RuleResult {
  const excluded = m.lpa.excludedSectors.includes(d.round.sector);
  const permitted = m.icCharter.sectors.includes(d.round.sector);
  return {
    pass: !excluded && permitted,
    clause: "ic_charter.sectors",
    sectionRef: "Mandate §2",
    detail: excluded
      ? `Sector "${d.round.sector}" is on the LPA exclusion list.`
      : permitted
        ? `Sector "${d.round.sector}" is permitted.`
        : `Sector "${d.round.sector}" is not in the IC charter sector list.`,
  };
}

export function checkGeographyAllowed(m: Mandate, d: ParsedDeal): RuleResult {
  const permitted = m.icCharter.geographies.includes(d.round.geography);
  return {
    pass: permitted,
    clause: "ic_charter.geographies",
    sectionRef: "Mandate §2",
    detail: permitted
      ? `Geography "${d.round.geography}" is permitted.`
      : `Geography "${d.round.geography}" is not in the IC charter geography list.`,
  };
}

// ---------- IC charter (softer) ----------

export function checkStageMatch(m: Mandate, d: ParsedDeal): RuleResult {
  const ok = m.icCharter.stages.includes(d.round.stage);
  return {
    pass: ok,
    clause: "ic_charter.stages",
    sectionRef: "Mandate §2",
    detail: ok
      ? `Stage "${d.round.stage}" is in the IC charter.`
      : `Stage "${d.round.stage}" is outside the IC charter (${m.icCharter.stages.join(", ")}).`,
  };
}

export function checkCheckSizeBand(m: Mandate, d: ParsedDeal): RuleResult {
  const { min, max } = m.icCharter.checkSizeUsd;
  const inBand = d.amountUsd >= min && d.amountUsd <= max;
  return {
    pass: inBand,
    clause: "ic_charter.check_size_usd",
    sectionRef: "Mandate §2",
    detail: `Cheque ${fmtUsd(d.amountUsd)}; band ${fmtUsd(min)} – ${fmtUsd(max)}.`,
  };
}

// ---------- Syndicate quality ----------

export function checkTier1LeadRequired(m: Mandate, d: ParsedDeal): RuleResult {
  const requiresTier1 = d.amountUsd > m.syndicateQuality.tier1LeadRequiredAboveUsd;
  if (!requiresTier1) {
    return {
      pass: true,
      clause: "syndicate_quality.tier1_lead_required_above_usd",
      sectionRef: "Mandate §4",
      detail: `Cheque ${fmtUsd(d.amountUsd)} ≤ tier-1 threshold ${fmtUsd(m.syndicateQuality.tier1LeadRequiredAboveUsd)}; no tier-1 lead required.`,
    };
  }
  const lead = (d.round.leadInvestor ?? "").toLowerCase().replace(/[^a-z0-9]/g, "_");
  const isTier1 = m.syndicateQuality.tier1Funds.some((t) =>
    lead.includes(t.toLowerCase()),
  );
  return {
    pass: isTier1,
    clause: "syndicate_quality.tier1_lead_required_above_usd",
    sectionRef: "Mandate §4",
    detail: isTier1
      ? `Lead "${d.round.leadInvestor}" is on the tier-1 list.`
      : `Cheque ${fmtUsd(d.amountUsd)} requires a tier-1 lead; "${d.round.leadInvestor}" is not on the list.`,
  };
}

// ---------- Signing matrix ----------

export function checkSigningMatrix(m: Mandate, d: ParsedDeal): RuleResult {
  const tier = m.signingMatrix.find((t) => d.amountUsd <= t.threshold_usd);
  if (!tier) {
    const top = m.signingMatrix[m.signingMatrix.length - 1];
    return {
      pass: false,
      clause: "signing_matrix",
      sectionRef: "Mandate §5",
      detail: `Cheque ${fmtUsd(d.amountUsd)} exceeds the largest tier (${fmtUsd(top?.threshold_usd ?? 0)}).`,
    };
  }
  return {
    pass: true,
    clause: "signing_matrix",
    sectionRef: "Mandate §5",
    detail: `Cheque ${fmtUsd(d.amountUsd)} → ${tier.signers_required} signer(s) (${tier.eligible_roles.join("/")})${tier.requires_ic_minutes ? " + IC minutes" : ""}.`,
  };
}

// ---------- Run-all helper ----------

export function evaluateAllRules(
  m: Mandate,
  d: ParsedDeal,
  s: FundState,
): RuleResult[] {
  return [
    checkSingleInvestmentCap(m, d, s),
    checkFollowOnCap(m, d, s),
    checkSectorAllowed(m, d),
    checkGeographyAllowed(m, d),
    checkStageMatch(m, d),
    checkCheckSizeBand(m, d),
    checkTier1LeadRequired(m, d),
    checkSigningMatrix(m, d),
  ];
}
