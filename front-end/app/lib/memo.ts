"use client";

/**
 * GET /api/memo/[runId]
 *
 * Returns the canonical MemoData rendered server-side. The Memo screen
 * reads every editorial string (summary, recommendation,
 * requiredActions) from this response — no FE-side derivation.
 */

import { apiFetch } from "./api";
import type { MemoData } from "./contract";

export function getMemo(runId: string, signal?: AbortSignal): Promise<MemoData> {
  return apiFetch<MemoData>(`/api/memo/${encodeURIComponent(runId)}`, { signal });
}
