/**
 * Narrative-text helper used by the memo editorial summary and the
 * amendment rationale. Two paths, in order of preference:
 *
 *   1. Cursor TypeScript SDK (`@cursor/sdk`) — kicks off a single-prompt
 *      local agent (no repo edits, just a one-shot text response) using
 *      `Agent.prompt()`. Enabled when `CURSOR_API_KEY` is set.
 *      See https://cursor.com/blog/typescript-sdk and
 *      https://cursor.com/docs/sdk/typescript.
 *
 *   2. Plain OpenAI-compatible `/chat/completions` — used when only
 *      `OPENAI_API_KEY` is configured.
 *
 * If neither is configured (or the call fails), callers fall back to a
 * deterministic template — no LLM is in the underwriting hot path.
 */

import { Agent, type SDKAgent } from "@cursor/sdk";

export interface OpenAIConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
}

export interface CursorSdkConfig {
  apiKey: string;
  /** Cursor model id, e.g. "composer-2", "auto". */
  model: string;
}

export function readCursorSdkConfig(): CursorSdkConfig | null {
  if (process.env.UNDERWRITER_DISABLE_CURSOR_SDK === "true") return null;
  const apiKey = process.env.CURSOR_API_KEY || "";
  if (!apiKey) return null;
  const model = process.env.CURSOR_MODEL || "composer-2";
  return { apiKey, model };
}

export function readOpenAIConfig(): OpenAIConfig | null {
  const apiKey = process.env.OPENAI_API_KEY || "";
  if (!apiKey) return null;
  const baseUrl = process.env.OPENAI_API_BASE || "";
  const model = process.env.OPENAI_MEMO_MODEL || "";
  if (!baseUrl || !model) return null;
  return { apiKey, baseUrl, model };
}

export interface ChatRequest {
  system: string;
  user: string;
  /** Soft cap for the response. The Cursor SDK ignores this; OpenAI honours it. */
  maxTokens?: number;
}

export async function chatComplete(req: ChatRequest): Promise<string | null> {
  const cursor = readCursorSdkConfig();
  if (cursor) {
    const text = await chatViaCursorSdk(cursor, req);
    if (text) return text;
  }
  const openai = readOpenAIConfig();
  if (openai) {
    const text = await chatViaOpenAI(openai, req);
    if (text) return text;
  }
  return null;
}

async function chatViaCursorSdk(
  cfg: CursorSdkConfig,
  req: ChatRequest,
): Promise<string | null> {
  // Single-shot: create → send → collect assistant text from the stream
  // → dispose. The prompt explicitly asks for prose so the agent does
  // not invoke editing tools against the cwd.
  const prompt = [
    req.system.trim(),
    "",
    req.user.trim(),
    "",
    "Respond with prose only — no tool calls, no shell, no code edits, no markdown headings, no bullet lists. Plain sentences.",
  ].join("\n");

  let agent: SDKAgent | null = null;
  try {
    agent = await Agent.create({
      apiKey: cfg.apiKey,
      model: { id: cfg.model },
      local: { cwd: process.cwd() },
    });
    const run = await agent.send(prompt);
    let text = "";
    for await (const ev of run.stream()) {
      if (ev.type === "assistant") {
        for (const block of ev.message.content) {
          if (block.type === "text") text += block.text;
        }
      }
    }
    const result = await run.wait();
    if (result.status !== "finished") return null;
    return text.trim() || null;
  } catch {
    return null;
  } finally {
    try {
      await agent?.[Symbol.asyncDispose]();
    } catch {
      // ignore disposal errors
    }
  }
}

async function chatViaOpenAI(
  cfg: OpenAIConfig,
  req: ChatRequest,
): Promise<string | null> {
  const url = cfg.baseUrl.replace(/\/$/, "") + "/chat/completions";
  const body = {
    model: cfg.model,
    messages: [
      { role: "system", content: req.system },
      { role: "user", content: req.user },
    ],
    max_tokens: req.maxTokens ?? 200,
    temperature: 0.2,
  };
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${cfg.apiKey}`,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const text = json.choices?.[0]?.message?.content?.trim() ?? "";
    return text || null;
  } catch {
    return null;
  }
}
