/**
 * Probe to confirm `chatComplete` (lib/sources/llm.ts) routes through the
 * Cursor TypeScript SDK when CURSOR_API_KEY is set.
 *
 *   npx tsx scripts/sdk-probe.ts
 */

import { chatComplete, readCursorSdkConfig, readOpenAIConfig } from "../lib/sources/llm";

async function main(): Promise<void> {
  console.log("Cursor SDK config:", readCursorSdkConfig());
  console.log("OpenAI config:", readOpenAIConfig() ? "<set>" : null);

  const text = await chatComplete({
    system:
      "You are a one-line summarizer for a venture-fund underwriting demo. Reply with one factual sentence.",
    user: "Summarize: UnderWriter is an autonomous VC underwriting demo with six diligence desks.",
    maxTokens: 60,
  });

  console.log("\nResponse:");
  console.log(text ?? "<null — fell through all providers>");
}

main().catch((err) => {
  console.error("probe failed:", err);
  process.exit(1);
});
