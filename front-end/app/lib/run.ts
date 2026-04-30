"use client";

/**
 * POST /api/run — opens an SSE stream by reading the response body.
 *
 * Why fetch + ReadableStream instead of native EventSource:
 *   - The endpoint is POST with a JSON body; EventSource is GET-only.
 *   - We don't need cross-origin reconnection (single-instance backend
 *     with no run replay), so we forfeit very little.
 *
 * Wire format (see backend/app/api/run/route.ts and INGESTION.md §6.1):
 *   data: <json>\n\n        ← every event is a single data line
 *   ...
 *
 * The discriminator is the JSON's `type` field, NOT the `event:` line
 * (there is no `event:` line). Frames are separated by blank lines.
 *
 * Flexibility: this consumer doesn't know the RunEvent variants — it
 * just decodes JSON and hands frames to the caller's dispatch. Adding
 * a new event type is one new case in the reducer; nothing here.
 */

import { BACKEND_URL } from "./api";
import type { RunEvent, RunRequest } from "./contract";

export type RunDispatch = (event: RunEvent) => void;

export interface StartRunResult {
  /** Resolves when the SSE stream closes cleanly. */
  done: Promise<void>;
  /** Cancel the stream. Idempotent. */
  abort: () => void;
}

export function startRun(body: RunRequest, dispatch: RunDispatch): StartRunResult {
  const controller = new AbortController();
  let aborted = false;

  const abort = () => {
    if (aborted) return;
    aborted = true;
    controller.abort();
  };

  const done = (async () => {
    let res: Response;
    try {
      res = await fetch(`${BACKEND_URL}/api/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } catch (err) {
      if (!aborted) {
        dispatch({
          type: "error",
          message: `network error opening run: ${(err as Error).message}`,
        });
      }
      return;
    }

    if (!res.ok || !res.body) {
      dispatch({
        type: "error",
        message: `POST /api/run failed: ${res.status} ${res.statusText}`,
      });
      return;
    }

    const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
    let buffer = "";

    try {
      while (true) {
        const { value, done: streamDone } = await reader.read();
        if (streamDone) break;
        buffer += value;

        // SSE frames separated by blank line. Tolerate \r\n line endings.
        let sepIdx: number;
        while ((sepIdx = findFrameBoundary(buffer)) !== -1) {
          const frame = buffer.slice(0, sepIdx);
          buffer = buffer.slice(sepIdx + frameSeparatorLength(buffer, sepIdx));
          handleFrame(frame, dispatch);
        }
      }
      // Stream closed cleanly. Drain any trailing frame.
      if (buffer.trim().length > 0) handleFrame(buffer, dispatch);
    } catch (err) {
      if (!aborted) {
        dispatch({
          type: "error",
          message: `stream interrupted: ${(err as Error).message}`,
        });
      }
    }
  })();

  return { done, abort };
}

/* ----------------------- frame parsing ----------------------- */

/** Locate the next blank-line frame boundary; returns -1 if none. */
function findFrameBoundary(buf: string): number {
  // Prefer LF-only; tolerate CRLF.
  const a = buf.indexOf("\n\n");
  const b = buf.indexOf("\r\n\r\n");
  if (a === -1) return b;
  if (b === -1) return a;
  return Math.min(a, b);
}

function frameSeparatorLength(buf: string, idx: number): number {
  return buf.startsWith("\r\n\r\n", idx) ? 4 : 2;
}

function handleFrame(frame: string, dispatch: RunDispatch): void {
  // SSE frames may have multiple lines (event:, id:, retry:, data:). The
  // current backend emits only `data: <json>` per frame, but we handle
  // multi-line `data:` too — concatenate them with \n per spec.
  const lines = frame.split(/\r?\n/);
  let dataParts: string[] = [];
  for (const line of lines) {
    if (line.startsWith(":")) continue; // SSE comment
    if (line.startsWith("data:")) {
      dataParts.push(line.slice(5).trimStart());
    }
    // ignore event:, id:, retry: — the contract uses the JSON's `type`
    // field as the discriminator.
  }
  if (dataParts.length === 0) return;

  const payload = dataParts.join("\n");
  let parsed: unknown;
  try {
    parsed = JSON.parse(payload);
  } catch {
    dispatch({
      type: "error",
      message: `malformed SSE frame (not JSON)`,
    });
    return;
  }

  if (typeof parsed !== "object" || parsed === null || !("type" in parsed)) {
    dispatch({
      type: "error",
      message: `malformed SSE frame (missing type)`,
    });
    return;
  }

  // Type-narrow at the seam. Unknown event types pass through to the
  // dispatcher; the reducer's default branch logs and ignores them, so
  // additive contract changes don't break the FE.
  dispatch(parsed as RunEvent);
}
