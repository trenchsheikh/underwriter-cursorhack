/**
 * In-memory wire ledger. Restart wipes state. (Backend.md §11.)
 */

import { newRunId, nowIso } from "./util";

export type LedgerStatus = "queued" | "held" | "wired";

export interface LedgerEntry {
  id: string;
  runId: string;
  status: LedgerStatus;
  amountUsd: number;
  recipient: string;
  reason?: string;
  at: string;
}

const ledger: LedgerEntry[] = [];

export function queueWire(
  entry: Omit<LedgerEntry, "id" | "at" | "status"> & { status?: LedgerStatus },
): LedgerEntry {
  const e: LedgerEntry = {
    id: newRunId(),
    at: nowIso(),
    status: entry.status ?? "queued",
    runId: entry.runId,
    amountUsd: entry.amountUsd,
    recipient: entry.recipient,
    reason: entry.reason,
  };
  ledger.unshift(e);
  return e;
}

export function holdWire(runId: string, reason: string, amountUsd: number, recipient: string): LedgerEntry {
  return queueWire({ runId, amountUsd, recipient, reason, status: "held" });
}

export function getLedger(): LedgerEntry[] {
  return ledger.slice();
}
