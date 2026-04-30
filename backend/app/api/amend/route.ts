import { NextResponse } from "next/server";

import { draftAmendment } from "../../../agents/amend";
import type { OverrideContext } from "../../../lib/contract";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let body: OverrideContext;
  try {
    body = (await req.json()) as OverrideContext;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  if (!body.runId || !body.blockingDesk) {
    return NextResponse.json(
      { error: "runId and blockingDesk are required" },
      { status: 400 },
    );
  }

  const draft = await draftAmendment(body);
  return NextResponse.json(draft);
}
