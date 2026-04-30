import type { Desk, PromptFile, RunState, ScenarioFixture } from "./types";

export const PROMPT_TEXT = `Wire $2,000,000 to Acme Robotics for their Series A.
Lead is Sequoia. 50% pro-rata of our $4,000,000 allocation.
SPA and wire instructions attached.`;

export const FILES_CLEAN: PromptFile[] = [
  { name: "acme_spa.pdf", size: "124 KB", icon: "file-text" },
  { name: "wire_instructions_clean.pdf", size: "38 KB", icon: "file-text" },
];

export const FILES_BEC: PromptFile[] = [
  { name: "acme_spa.pdf", size: "124 KB", icon: "file-text" },
  { name: "wire_instructions_bec.eml", size: "12 KB", icon: "mail" },
];

const CLEAN_DESKS: Desk[] = [
  {
    n: "01", name: "Company Desk", icon: "building",
    primary: "Acme Robotics Ltd",
    facts: "Inc. 2021 · 47 FTE · Active · Cambridge, UK",
    cites: [
      { src: "specter", text: "Specter · ABC-92" },
      { src: "ch",      text: "Companies House · 13427891" },
      { src: "whois",   text: "acmerobotics.com (verified)", link: true },
    ],
    conf: "0.94", dur: "4.2s", delay: 5000, status: "pass",
  },
  {
    n: "02", name: "Founder Desk", icon: "user",
    primary: "Sarah Chen, CEO/Co-founder",
    facts: "ex-Boston Dynamics, ex-DeepMind robotics · Prior exit: Cobalt Robotics → ABB (2019)",
    cites: [
      { src: "specter", text: "Specter People · P-441829" },
      { src: "whois",   text: "LinkedIn (verified)", link: true },
      { src: "specter", text: "Crunchbase exits · 1" },
    ],
    conf: "0.91", dur: "3.8s", delay: 8000, status: "pass",
  },
  {
    n: "03", name: "Lead Investor Desk", icon: "trending-up",
    primary: "Sequoia Capital — engagement confirmed",
    facts: "4 partner signals, last 60 days · pattern consistent with lead in EU robotics",
    cites: [
      { src: "specter", text: "Specter Interest Signals · 4" },
      { src: "specter", text: "Comparable lead rounds · 11" },
    ],
    conf: "0.88", dur: "7.1s", delay: 12000, status: "pass",
  },
  {
    n: "04", name: "Round Dynamics Desk", icon: "bar-chart",
    primary: "$18M Series A · $80M post-money",
    facts: "EU robotics 2025 median: $16M @ $74M · pro-rata math reconciles ($2M = 50% of $4M)",
    cites: [
      { src: "specter", text: "Specter Transactions · n=23" },
      { src: "mandate", text: "SPA parsed · valuation §3.1" },
    ],
    conf: "0.87", dur: "5.3s", delay: 16000, status: "pass",
  },
  {
    n: "05", name: "Mandate Desk", icon: "shield",
    primary: "8 of 8 rules pass",
    facts: "$2M within signing matrix tier (2 signers) · Sector permitted · Geography permitted",
    cites: [
      { src: "mandate", text: "MANDATE.md v12 · clauses 2,3,4,5" },
    ],
    conf: "0.99", dur: "0.4s", delay: 22000, status: "pass",
  },
  {
    n: "06", name: "Wire Safety Desk", icon: "lock",
    primary: "Domain acme.co · age 1,847 days",
    facts: "DKIM ✓ · SPF ✓ · BO match ✓ · No sanctions or PEP hits",
    cites: [
      { src: "whois",     text: "WHOIS · 2021-01-15" },
      { src: "sanctions", text: "OpenSanctions · 4 lists clear" },
    ],
    conf: "0.96", dur: "6.0s", delay: 30000, status: "pass",
  },
];

const BEC_WIRE_DESK: Desk = {
  n: "06", name: "Wire Safety Desk", icon: "lock",
  primary: "Lookalike domain · DKIM FAIL",
  facts: "Source founder@acrne.co vs verified founder@acme.co · edit distance 1",
  cites: [
    { src: "whois",   text: "WHOIS · 2026-04-24 (6 days)" },
    { src: "mandate", text: "Mandate clause · wire_safety §6.2" },
    { src: "block",   text: "Pattern · BEC fraud" },
  ],
  conf: "0.99", dur: "6.1s", delay: 30000, status: "block",
};

export const FIXTURES: { clean: ScenarioFixture; bec: ScenarioFixture } = {
  clean: { desks: CLEAN_DESKS },
  bec:   { desks: [...CLEAN_DESKS.slice(0, 5), BEC_WIRE_DESK] },
};

export const INITIAL_RUN_STATE: RunState = {
  mode: "idle",
  scenario: null,
  prompt: "",
  files: [],
  deskStates: Array(6).fill("idle"),
  citesShown: Array(6).fill(0),
  runStart: null,
};
