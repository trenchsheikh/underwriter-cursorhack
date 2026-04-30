/**
 * Tiny OpenAI-compatible wrapper. Used only for the **editorial summary**
 * sentence in the IC memo. If no key is set, callers fall back to a
 * deterministic template — no LLM is in the underwriting hot path.
 */

export interface LlmConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
}

export function readLlmConfig(): LlmConfig | null {
  const apiKey =
    process.env.OPENAI_API_KEY ||
    process.env.CURSOR_API_KEY ||
    "";
  if (!apiKey) return null;
  const baseUrl =
    process.env.OPENAI_API_BASE ||
    process.env.CURSOR_API_BASE_URL ||
    "https://api.openai.com/v1";
  const model =
    process.env.OPENAI_MEMO_MODEL ||
    process.env.CURSOR_MODEL ||
    "gpt-4o-mini";
  return { apiKey, baseUrl, model };
}

export async function chatComplete(opts: {
  system: string;
  user: string;
  maxTokens?: number;
}): Promise<string | null> {
  const cfg = readLlmConfig();
  if (!cfg) return null;
  const url = cfg.baseUrl.replace(/\/$/, "") + "/chat/completions";
  const body = {
    model: cfg.model,
    messages: [
      { role: "system", content: opts.system },
      { role: "user", content: opts.user },
    ],
    max_tokens: opts.maxTokens ?? 200,
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
