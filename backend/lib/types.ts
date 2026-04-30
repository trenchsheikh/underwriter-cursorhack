/**
 * Internal types not exposed in the cross-team contract.
 * Kept out of `lib/contract.ts` so that file stays minimal and stable.
 */

import type { DeskId } from "./contract";
import type { SpecterSnapshot } from "./sources/specter";

// ----- Mandate (parsed from MANDATE.md frontmatter) ----------------

export interface SigningTier {
  threshold_usd: number;
  signers_required: number;
  eligible_roles: string[];
  requires_ic_minutes?: boolean;
}

export interface Mandate {
  /** Version inferred from amendment-log row count. */
  version: number;
  /** Path/clause label used in citations. */
  prose: string;

  fund: {
    id: string;
    name: string;
    sizeUsd: number;
    vintage: number;
    domicile: string;
    manager: string;
    fundLifeYears: number;
    investingPeriodYears: number;
  };

  lpa: {
    singleInvestmentCapPct: number;
    followOnCapPct: number;
    publicSecuritiesCapPct: number;
    reservesPct: number;
    excludedSectors: string[];
    excludedGeographies: string[];
  };

  icCharter: {
    stages: string[];
    checkSizeUsd: { min: number; max: number };
    ownershipTargetPct: number;
    ownershipFloorPct: number;
    geographies: string[];
    sectors: string[];
  };

  syndicateQuality: {
    tier1LeadRequiredAboveUsd: number;
    tier1Funds: string[];
    leadMustHavePriorRoundInSectorCount: number;
  };

  signingMatrix: SigningTier[];

  wireSafety: {
    domainAgeMinDays: number;
    domainEditDistanceBlock: number;
    requireDkimPass: boolean;
    requireSpfPass: boolean;
    requirePhoneConfirmationAboveUsd: number;
    requireDualChannelConfirmationAboveUsd: number;
    beneficialOwnerMatchRequired: boolean;
    accountHolderNameMatchRequired: boolean;
  };

  sanctions: {
    lists: string[];
    pepScreen: boolean;
    jurisdictions: string[];
  };

  calibration: {
    autoProceedMinConfidence: number;
    flagForReviewBelow: number;
    hardBlockOnAny: string[];
  };
}

// ----- Parsed deal (output of parsePrompt) -------------------------

export interface ParsedDeal {
  company: { name: string; domainHint?: string; companyId: string };
  round: {
    stage: "pre_seed" | "seed" | "series_a" | "series_b" | "other";
    leadInvestor?: string;
    sector: string;
    geography: string;
  };
  amountUsd: number;
  proRataPct?: number;
  totalAllocationUsd?: number;
}

// ----- Fund state (positions, called capital, etc.) ----------------

export interface FundState {
  asOf: string;
  calledCapitalUsd: number;
  positions: Record<string, number>;
}

// ----- Files attached to a run -------------------------------------

export interface ParsedFiles {
  /** Name of the wire-instructions fixture variant ("clean" | "bec"). */
  wireInstructionsKey?: "clean" | "bec";
  /** Pre-parsed SPA terms. */
  spa?: ParsedSpa;
  /** Pre-parsed wire instructions. */
  wireInstructions?: ParsedWireInstructions;
}

export interface ParsedSpa {
  valuationPostMoneyUsd: number;
  roundSizeUsd: number;
  leadInvestor: string;
  proRataPct: number;
  liquidationPref: string;
}

export interface ParsedWireInstructions {
  sourceEmailDomain: string;
  accountHolderName: string;
  bankCountry: string;
  swift: string;
  dkimPass: boolean;
  spfPass: boolean;
  /** ISO date the source domain was registered. */
  domainCreatedAt: string;
}

// ----- Rule evaluator output --------------------------------------

export interface RuleResult {
  pass: boolean;
  /** Path-style clause id (matches MANDATE.md frontmatter), e.g. "lpa.single_investment_cap_pct". */
  clause: string;
  detail: string;
  /** Optional human-readable section reference, e.g. "wire_safety §6.2". */
  sectionRef?: string;
}

// ----- Send fn (SSE writer passed to desks) ------------------------

import type { RunEvent } from "./contract";
export type SendFn = (event: RunEvent) => void;

export interface SpecterContext {
  snapshot: SpecterSnapshot;
  /** True when the snapshot came from a fixture (no live keys / offline). */
  cached: boolean;
  /** "live" when the snapshot was assembled from the Specter API; "fixture" otherwise. */
  mode: "live" | "fixture";
}

export type DeskRunner = (
  deal: ParsedDeal,
  mandate: Mandate,
  send: SendFn,
  ctx: { fundState: FundState; files: ParsedFiles; specter: SpecterContext },
) => Promise<import("./contract").DeskFinding>;

export type { DeskId };
