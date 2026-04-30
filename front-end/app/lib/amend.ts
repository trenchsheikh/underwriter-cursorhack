"use client";

/**
 * POST /api/amend — sends an OverrideContext, returns a draft PR.
 */

import { apiFetch } from "./api";
import type { AmendmentDraft, OverrideContext } from "./contract";

export function draftAmendment(
  ctx: OverrideContext,
  signal?: AbortSignal,
): Promise<AmendmentDraft> {
  return apiFetch<AmendmentDraft>("/api/amend", {
    method: "POST",
    body: JSON.stringify(ctx),
    signal,
  });
}
