import { NextResponse } from "next/server";

import { getMemo } from "../../../../agents/orchestrator";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  context: { params: Promise<{ runId: string }> },
) {
  const { runId } = await context.params;
  const memo = getMemo(runId);
  if (!memo) {
    return NextResponse.json(
      { error: "memo not found", runId },
      { status: 404 },
    );
  }
  return NextResponse.json(memo);
}
