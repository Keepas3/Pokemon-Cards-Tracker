// Validation for the Open-or-hold API. Pure, so the rules are testable without a request.

import type { Assumptions } from "./types";

type Result<T> = { ok: true; value: T } | { ok: false; error: string };
const fail = (error: string): { ok: false; error: string } => ({ ok: false, error });

const isObject = (b: unknown): b is Record<string, unknown> => typeof b === "object" && b != null;
const isInt = (v: unknown): v is number => typeof v === "number" && Number.isInteger(v);

/** Any subset of the assumptions; the rest are left as they are. */
export function parseAssumptions(body: unknown): Result<Partial<Assumptions>> {
  if (!isObject(body)) return fail("expected a JSON object");
  const out: Partial<Assumptions> = {};

  if ("feePct" in body) {
    const v = body.feePct;
    if (typeof v !== "number" || !Number.isFinite(v) || v < 0 || v > 50) return fail("fees must be between 0% and 50%");
    out.feePct = v;
  }
  if ("bulkThresholdCents" in body) {
    const v = body.bulkThresholdCents;
    if (!isInt(v) || v < 0 || v > 100_000) return fail("the bulk cut-off must be between $0 and $1,000");
    out.bulkThresholdCents = v;
  }
  if ("bulkPerPackCents" in body) {
    const v = body.bulkPerPackCents;
    if (!isInt(v) || v < 0 || v > 10_000) return fail("bulk value per pack must be between $0 and $100");
    out.bulkPerPackCents = v;
  }
  return { ok: true, value: out };
}

export interface PullRateInput {
  setId: number;
  rarity: string;
  /** Fraction of packs (0.05 = 5%); null removes your override. */
  perPack: number | null;
}

export function parsePullRate(body: unknown): Result<PullRateInput> {
  if (!isObject(body)) return fail("expected a JSON object");
  if (!isInt(body.setId)) return fail("setId is required");
  if (typeof body.rarity !== "string" || body.rarity.trim() === "") return fail("rarity is required");
  if (body.rarity.length > 80) return fail("rarity is too long");
  const v = body.perPack;
  if (v !== null && (typeof v !== "number" || !Number.isFinite(v) || v < 0 || v > 1)) {
    return fail("a pull rate is the share of packs, between 0% and 100%");
  }
  return { ok: true, value: { setId: body.setId, rarity: body.rarity.trim(), perPack: v as number | null } };
}

export interface PackCountInput {
  setId: number;
  itemExternalId: number;
  printing: string;
  /** null removes your override. */
  packs: number | null;
}

export function parsePackCount(body: unknown): Result<PackCountInput> {
  if (!isObject(body)) return fail("expected a JSON object");
  if (!isInt(body.setId) || !isInt(body.itemExternalId)) return fail("setId and itemExternalId are required");
  const printing = body.printing == null ? "" : body.printing;
  if (typeof printing !== "string") return fail("printing must be text");
  const v = body.packs;
  if (v !== null && (!isInt(v) || v < 1 || v > 1000)) return fail("packs must be a whole number from 1 to 1000");
  return { ok: true, value: { setId: body.setId, itemExternalId: body.itemExternalId, printing, packs: v as number | null } };
}

