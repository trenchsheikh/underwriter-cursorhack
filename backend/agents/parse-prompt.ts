import type { RunRequest } from "../lib/contract";
import type { ParsedDeal } from "../lib/types";

/**
 * Lightweight, deterministic prompt parsing for the demo fixtures.
 * The full spec calls for an LLM (Backend.md §12); for the demo we
 * key off the seed + obvious regex to keep the path keyless.
 *
 * Returns null if the prompt is unrecoverably underspecified.
 */
export function parsePrompt(req: RunRequest): ParsedDeal | null {
  const prompt = req.prompt ?? "";

  const amount = parseAmount(prompt);
  const stage = parseStage(prompt);
  const lead = parseLead(prompt);
  const proRata = parsePct(prompt, /(\d+(?:\.\d+)?)\s*%\s*pro[- ]rata/i);
  const allocation = parseAmount(prompt, /pro[- ]rata of (?:our )?\$?([\d,]+(?:\.\d+)?\s*[KMB]?)/i);

  const seedHasAcme =
    req.fixtureSeed === "clean-acme" ||
    req.fixtureSeed === "bec-acme" ||
    /acme robotics/i.test(prompt);
  const seedHasDex =
    req.fixtureSeed === "dex-meetdex" ||
    /\bdex\b|meetdex\.ai/i.test(prompt);

  const company = seedHasDex
    ? { name: "Dex", domainHint: "meetdex.ai", companyId: "dex" }
    : seedHasAcme
      ? { name: "Acme Robotics Ltd", domainHint: "acme.co", companyId: "acme-robotics" }
      : extractCompany(prompt);

  if (!company || !amount) return null;

  const defaultStage: ParsedDeal["round"]["stage"] = seedHasDex ? "seed" : "series_a";
  const defaultLead = seedHasDex ? "Andreessen Horowitz" : "Sequoia Capital";
  const sector = seedHasDex ? "ai_infrastructure" : "robotics";
  const geography = seedHasDex ? "EU" : "UK";

  return {
    company,
    round: {
      stage: stage ?? defaultStage,
      leadInvestor: lead ?? defaultLead,
      sector,
      geography,
    },
    amountUsd: amount,
    proRataPct: proRata ?? 50,
    totalAllocationUsd: allocation,
  };
}

function parseAmount(s: string, re?: RegExp): number | undefined {
  const m = (re ?? /\$([\d,]+(?:\.\d+)?\s*[KMB]?)/i).exec(s);
  if (!m) return undefined;
  return parseDollar(m[1]);
}

function parseDollar(raw: string): number {
  const t = raw.replace(/,/g, "").trim();
  const m = t.match(/^([\d.]+)\s*([KMB]?)$/i);
  if (!m) return Number(t) || 0;
  const n = Number(m[1]);
  const mult = { "": 1, K: 1e3, M: 1e6, B: 1e9 }[m[2].toUpperCase() as "" | "K" | "M" | "B"] ?? 1;
  return n * mult;
}

function parseStage(s: string): ParsedDeal["round"]["stage"] | undefined {
  if (/series\s*a/i.test(s)) return "series_a";
  if (/series\s*b/i.test(s)) return "series_b";
  if (/seed/i.test(s)) return "seed";
  if (/pre[- ]seed/i.test(s)) return "pre_seed";
  return undefined;
}

function parseLead(s: string): string | undefined {
  const m = /lead\s+is\s+([A-Z][\w& ]+?)(?:\.|,|$)/i.exec(s);
  return m?.[1]?.trim();
}

function parsePct(s: string, re: RegExp): number | undefined {
  const m = re.exec(s);
  return m ? Number(m[1]) : undefined;
}

function extractCompany(s: string): ParsedDeal["company"] | null {
  const m = /(?:wire\s+(?:to|\$[\d,]+\s+to))\s+([A-Z][\w &.-]+?)(?:\s+for|,|$)/i.exec(s);
  if (!m) return null;
  const name = m[1].trim();
  return {
    name,
    companyId: name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""),
  };
}
