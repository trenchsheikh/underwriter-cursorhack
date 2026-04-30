/**
 * SPA / wire-instructions parsing.
 *
 * For the demo we always return the pre-parsed fixture matching the
 * scenario seed. The live path would shell out to an LLM with a Zod
 * schema (see Backend.md §6.3 / §12).
 */

import { loadFixture } from "../cache";
import type { ParsedSpa, ParsedWireInstructions } from "../types";

export async function parseSPA(_ref: string): Promise<ParsedSpa> {
  return loadFixture<ParsedSpa>("fixtures/pdfs/spa-parsed.json");
}

export async function parseWireInstructions(
  variant: "clean" | "bec",
): Promise<ParsedWireInstructions> {
  const path =
    variant === "bec"
      ? "fixtures/pdfs/wire_instructions_bec.json"
      : "fixtures/pdfs/wire_instructions_clean.json";
  return loadFixture<ParsedWireInstructions>(path);
}
