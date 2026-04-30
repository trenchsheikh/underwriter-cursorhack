import type { Amendment } from "./types";

export const INITIAL_AMENDMENTS: Amendment[] = [
  {
    id: 14,
    date: "2026-04-02",
    author: "A. Patel",
    summary: "Added developer_tools to permitted sectors.",
    lines: "+1",
    diff: [
      "  permitted_sectors:",
      "    - robotics",
      "    - climate_hardware",
      "+   - developer_tools",
      "    - applied_ai",
    ],
    active: true,
  },
  {
    id: 12,
    date: "2026-03-18",
    author: "M. Okonkwo",
    summary: "Raised tier_2 ceiling from $3M to $5M.",
    lines: "~1",
    diff: [
      "  signing_matrix:",
      "    tier_1: { up_to_usd: 500_000, signers: 1 }",
      "-   tier_2: { up_to_usd: 3_000_000, signers: 2 }",
      "+   tier_2: { up_to_usd: 5_000_000, signers: 2 }",
    ],
  },
  {
    id: 11,
    date: "2026-02-27",
    author: "S. Lindqvist",
    summary: "Removed SAFE-above-$250K provision in line with revised LP terms.",
    lines: "−2",
    diff: ["- safes:", "-   max_principal_usd: 250_000"],
  },
  {
    id: 9,
    date: "2026-01-30",
    author: "A. Patel",
    summary: "Tightened wire-safety domain edit distance from 3 to 2.",
    lines: "~1",
    diff: [
      "  wire_safety:",
      "-   domain_edit_distance_block: 3",
      "+   domain_edit_distance_block: 2",
    ],
  },
];

export const MANDATE_FRONTMATTER = `fund: acme-ventures-iii
version: 12
last_amended: 2026-04-02
signing_matrix:
  tier_1: { up_to_usd: 500_000,    signers: 1 }
  tier_2: { up_to_usd: 5_000_000,  signers: 2 }
  tier_3: { up_to_usd: 25_000_000, signers: 3 }
permitted_sectors:
  - robotics
  - climate_hardware
  - developer_tools
  - applied_ai
permitted_geographies: [ UK, EU, US, CA ]
wire_safety:
  domain_age_min_days: 30
  domain_edit_distance_block: 2
  require_dkim: true
  require_bo_match: true`;

export const MANDATE_BODY: { tag: "h1" | "h2" | "p"; text: string }[] = [
  { tag: "h1", text: "Mandate — Acme Ventures III" },
  { tag: "p",  text: "This document is the executable policy of Acme Ventures III. Every wire, every commitment, every override is checked against the rules below before money moves. The agent named Mandate enforces it; the partners amend it via PR." },
  { tag: "h2", text: "1. Charter" },
  { tag: "p",  text: "Acme Ventures III is a £200M early-stage fund investing in robotics, climate hardware, developer tools, and applied AI across the UK, EU, US, and Canada. We lead or co-lead Seed and Series A rounds, with reserve allocations for follow-on at Series B." },
  { tag: "h2", text: "2. Investment perimeter" },
  { tag: "p",  text: "Initial cheques between $500K and $5M. Pro-rata reserves up to 1.5× the initial cheque. No debt, no SAFEs above $250K, no secondaries without LP advisory consent." },
  { tag: "h2", text: "3. Signing matrix" },
  { tag: "p",  text: "Wires up to $500K require one signer; up to $5M require two; up to $25M require three. Anything above $25M is an LP advisory matter." },
  { tag: "h2", text: "4. Sector & geography" },
  { tag: "p",  text: "Capital is permitted to flow to companies operating in the four sectors above and headquartered in the four geographies above. Cross-border holdings are permitted where ultimate beneficial ownership reconciles to a permitted jurisdiction." },
  { tag: "h2", text: "5. Diligence requirements" },
  { tag: "p",  text: "Six desks must resolve before a wire is released: company, founder, lead investor, round dynamics, mandate compliance, wire safety. A flag from any desk requires partner override; a block from wire safety requires out-of-band confirmation per §6.4." },
  { tag: "h2", text: "6. Wire safety" },
  { tag: "p",  text: "Wire instructions must originate from a verified company domain at least 30 days old. Edit distance from any known company domain greater than 2 triggers a block. DKIM must pass. Beneficial owner on the receiving account must reconcile to the SPA. Phone confirmation is required for any wire above $1M when a flag is open." },
];
