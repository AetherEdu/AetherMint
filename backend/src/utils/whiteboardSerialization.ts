/**
 * Drawing-instruction serialization helpers.
 *
 * The wire format used by `WhiteboardOp` is already compact (no metadata
 * beyond what we need to replay), but on the boundary between live socket
 * traffic and persisted storage we still:
 *
 *  - round-trip floats to a fixed 2-decimal precision so the JSON hash is
 *    deterministic (helpful for diff-based conflict UI),
 *  - drop ops with degenerate point payloads,
 *  - normalize timestamp to monotonic Unix-ms, and
 *  - assign a sequential `seq` if missing so replay is deterministic.
 *
 * This module is intentionally framework-free and pure — it is reused by
 * both the live socket service and the HTTP controller.
 */

import type { WhiteboardOp } from '../models/WhiteboardSession';

const DEFAULT_PRECISION = 2;

function round(value: number, digits = DEFAULT_PRECISION): number {
  const factor = Math.pow(10, digits);
  return Math.round(value * factor) / factor;
}

export interface SerializeOptions {
  /** Assign sequential numbers when `seq` is missing. Defaults to true. */
  assignSeq?: boolean;
  /** Point coordinate precision. Defaults to 2. */
  precision?: number;
}

/**
 * Validate + normalize a list of ops coming off the wire. Returns the
 * canonical representation ready for storage. Invalid ops are filtered out
 * silently rather than throwing — we want a save to succeed even if a few
 * malformed entries slipped through.
 */
export function serializeOps(
  input: ReadonlyArray<WhiteboardOp>,
  options: SerializeOptions = {}
): WhiteboardOp[] {
  const assignSeq = options.assignSeq !== false;
  const precision = options.precision ?? DEFAULT_PRECISION;
  const out: WhiteboardOp[] = [];

  let nextSeq = 1;
  let lastTs = 0;
  for (const op of input) {
    if (!op || typeof op !== 'object') continue;
    if (typeof op.tool !== 'string') continue;
    if (!op.userId || typeof op.userId !== 'string') continue;
    if (!Array.isArray(op.points) || op.points.length === 0) continue;

    const normalized: WhiteboardOp = {
      tool: op.tool,
      userId: op.userId,
      ts: Number.isFinite(op.ts) ? Math.max(op.ts, lastTs) : Date.now(),
      color: typeof op.color === 'string' ? op.color : null,
      width: Number.isFinite(op.width) ? Math.max(1, op.width) : 2,
      points: op.points.map((p) => ({
        x: round(Number(p?.x ?? 0), precision),
        y: round(Number(p?.y ?? 0), precision),
      })),
      text: typeof op.text === 'string' ? op.text : undefined,
    };

    lastTs = normalized.ts;
    if (typeof op.seq === 'number') {
      normalized.seq = op.seq;
      nextSeq = Math.max(nextSeq, op.seq + 1);
    } else if (assignSeq) {
      normalized.seq = nextSeq++;
    }
    out.push(normalized);
  }

  return out;
}

/**
 * Cost estimate for the serialized payload. Used by the controller to reject
 * outsized saves (e.g. a runaway client streaming the same stroke forever).
 * The ceiling is intentionally generous — 1 MB handles dense diagrams.
 */
export function estimateOpsBytes(ops: ReadonlyArray<WhiteboardOp>): number {
  // Approximate: each op has ~5 strings + a small points array. 80 bytes per
  // op + 24 bytes per point is a generous upper bound.
  let bytes = 0;
  for (const op of ops) {
    bytes += 80;
    bytes += (op.points?.length ?? 0) * 24;
  }
  return bytes;
}

export const MAX_OPS_BYTES = 1_000_000;
