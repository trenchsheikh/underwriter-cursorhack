import type { NextRequest } from "next/server";

import { runOrchestrator } from "../../../agents/orchestrator";
import type { RunEvent, RunRequest } from "../../../lib/contract";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/run
 *
 * Body: RunRequest
 * Streams SSE events of type RunEvent (see lib/contract.ts).
 *
 * Order of events guaranteed by spec:
 *   run.init
 *   per desk: desk.start [desk.progress|desk.citation]* desk.resolved
 *   verdict
 *   memo.ready
 */
export async function POST(req: NextRequest) {
  let body: RunRequest;
  try {
    body = (await req.json()) as RunRequest;
  } catch {
    body = { prompt: "", files: [] };
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false;
      const send = (event: RunEvent) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        } catch {
          /* controller already closed */
        }
      };
      try {
        await runOrchestrator(body, send);
      } catch (err) {
        send({ type: "error", message: String(err).slice(0, 300) });
      } finally {
        closed = true;
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
