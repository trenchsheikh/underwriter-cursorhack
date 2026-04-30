import { readFile } from "node:fs/promises";
import { join } from "node:path";
import matter from "gray-matter";

import type { Mandate, SigningTier } from "./types";

/**
 * Load and parse `MANDATE.md` from the backend root. The YAML frontmatter
 * is the runtime policy; the prose is what LPs read. Version is inferred
 * by counting amendment-log rows.
 */
export async function loadMandate(): Promise<Mandate> {
  const path = join(/* turbopackIgnore: true */ process.cwd(), "MANDATE.md");
  const raw = await readFile(path, "utf8");
  const { data, content } = matter(raw);
  return mapFrontmatter(data, content);
}

function inferVersion(prose: string): number {
  const lines = prose.split("\n");
  // Count rows in the amendment-log markdown table — each row begins "| YYYY-".
  const rows = lines.filter((l) => /^\|\s*\d{4}-\d{2}-\d{2}\s*\|/.test(l));
  return Math.max(rows.length, 1);
}

function num(v: unknown, fallback = 0): number {
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const cleaned = v.replace(/_/g, "");
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : fallback;
  }
  return fallback;
}

function arr<T = string>(v: unknown): T[] {
  return Array.isArray(v) ? (v as T[]) : [];
}

function mapFrontmatter(data: Record<string, unknown>, prose: string): Mandate {
  const fundRaw = (data.fund ?? {}) as Record<string, unknown>;
  const lpaRaw = (data.lpa ?? {}) as Record<string, unknown>;
  const icRaw = (data.ic_charter ?? {}) as Record<string, unknown>;
  const synRaw = (data.syndicate_quality ?? {}) as Record<string, unknown>;
  const wsRaw = (data.wire_safety ?? {}) as Record<string, unknown>;
  const sanRaw = (data.sanctions ?? {}) as Record<string, unknown>;
  const calRaw = (data.calibration ?? {}) as Record<string, unknown>;
  const sigRaw = arr<Record<string, unknown>>(data.signing_matrix);
  const checkRaw = (icRaw.check_size_usd ?? {}) as Record<string, unknown>;

  const signingMatrix: SigningTier[] = sigRaw.map((t) => ({
    threshold_usd: num(t.threshold_usd),
    signers_required: num(t.signers_required, 1),
    eligible_roles: arr<string>(t.eligible_roles),
    requires_ic_minutes: Boolean(t.requires_ic_minutes ?? false),
  }));

  const fundName = String(fundRaw.name ?? "Unknown Fund");
  const fundId = fundName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

  return {
    version: inferVersion(prose),
    prose,
    fund: {
      id: fundId,
      name: fundName,
      sizeUsd: num(fundRaw.size_usd),
      vintage: num(fundRaw.vintage),
      domicile: String(fundRaw.domicile ?? ""),
      manager: String(fundRaw.manager ?? ""),
      fundLifeYears: num(fundRaw.fund_life_years, 10),
      investingPeriodYears: num(fundRaw.investing_period_years, 5),
    },
    lpa: {
      singleInvestmentCapPct: num(lpaRaw.single_investment_cap_pct, 10),
      followOnCapPct: num(lpaRaw.follow_on_cap_pct, 15),
      publicSecuritiesCapPct: num(lpaRaw.public_securities_cap_pct, 15),
      reservesPct: num(lpaRaw.reserves_pct, 50),
      excludedSectors: arr<string>(lpaRaw.excluded_sectors),
      excludedGeographies: arr<string>(lpaRaw.excluded_geographies),
    },
    icCharter: {
      stages: arr<string>(icRaw.stages),
      checkSizeUsd: {
        min: num(checkRaw.min, 0),
        max: num(checkRaw.max, 0),
      },
      ownershipTargetPct: num(icRaw.ownership_target_pct, 0),
      ownershipFloorPct: num(icRaw.ownership_floor_pct, 0),
      geographies: arr<string>(icRaw.geographies),
      sectors: arr<string>(icRaw.sectors),
    },
    syndicateQuality: {
      tier1LeadRequiredAboveUsd: num(synRaw.tier1_lead_required_above_usd, 0),
      tier1Funds: arr<string>(synRaw.tier1_funds),
      leadMustHavePriorRoundInSectorCount: num(
        synRaw.lead_must_have_prior_round_in_sector_count,
        3,
      ),
    },
    signingMatrix,
    wireSafety: {
      domainAgeMinDays: num(wsRaw.domain_age_min_days, 30),
      domainEditDistanceBlock: num(wsRaw.domain_edit_distance_block, 2),
      requireDkimPass: Boolean(wsRaw.require_dkim_pass ?? true),
      requireSpfPass: Boolean(wsRaw.require_spf_pass ?? true),
      requirePhoneConfirmationAboveUsd: num(
        wsRaw.require_phone_confirmation_above_usd,
        1_000_000,
      ),
      requireDualChannelConfirmationAboveUsd: num(
        wsRaw.require_dual_channel_confirmation_above_usd,
        2_000_000,
      ),
      beneficialOwnerMatchRequired: Boolean(
        wsRaw.beneficial_owner_match_required ?? true,
      ),
      accountHolderNameMatchRequired: Boolean(
        wsRaw.account_holder_name_match_required ?? true,
      ),
    },
    sanctions: {
      lists: arr<string>(sanRaw.lists),
      pepScreen: Boolean(sanRaw.pep_screen ?? true),
      jurisdictions: arr<string>(sanRaw.jurisdictions),
    },
    calibration: {
      autoProceedMinConfidence: num(calRaw.auto_proceed_min_confidence, 0.85),
      flagForReviewBelow: num(calRaw.flag_for_review_below, 0.7),
      hardBlockOnAny: arr<string>(calRaw.hard_block_on_any),
    },
  };
}
