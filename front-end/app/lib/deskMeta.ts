"use client";

/**
 * Frontend-only metadata for the six desks.
 *
 * The contract (DeskFinding) carries `desk`, `number`, and `title`.
 * It does NOT carry an icon — that's a UI concern. This file is the
 * single place that maps DeskId → icon name + display title (kept
 * title-case to match the existing FE styling, even though the
 * contract emits upper-case `title`s).
 *
 * Adding a new desk: extend DESK_ORDER + DESK_META together. No other
 * file in the FE needs to change.
 */

import type { IconName } from "../components/Icon";
import type { DeskId, DeskNumber } from "./contract";

export const DESK_ORDER: DeskId[] = [
  "company",
  "founder",
  "investor",
  "round",
  "mandate",
  "wire",
];

export interface DeskMeta {
  number: DeskNumber;
  title: string;
  icon: IconName;
}

export const DESK_META: Record<DeskId, DeskMeta> = {
  company:  { number: "01", title: "Company Desk",        icon: "building"    },
  founder:  { number: "02", title: "Founder Desk",        icon: "user"        },
  investor: { number: "03", title: "Lead Investor Desk",  icon: "trending-up" },
  round:    { number: "04", title: "Round Dynamics Desk", icon: "bar-chart"   },
  mandate:  { number: "05", title: "Mandate Desk",        icon: "shield"      },
  wire:     { number: "06", title: "Wire Safety Desk",    icon: "lock"        },
};

/** Lookup helper that doesn't blow up on an unknown DeskId. */
export function deskIndex(id: DeskId): number {
  return DESK_ORDER.indexOf(id);
}
