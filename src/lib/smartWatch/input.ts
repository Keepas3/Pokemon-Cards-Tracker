// Validation for the smart-watch API. Pure, so the rules are testable without a request.

import type { RuleCriteria } from "./match";

type Result<T> = { ok: true; value: T } | { ok: false; error: string };

export const MAX_RULE_PRICE_CENTS = 10_000_000; // $100,000 — a typo guard, not a real limit
const MAX_TEXT = 80;
const MAX_NAME = 120;

const fail = (error: string): { ok: false; error: string } => ({ ok: false, error });

/** Trims; blank and null both mean "not set". */
function optionalText(v: unknown, field: string, max: number): Result<string | null> {
  if (v == null) return { ok: true, value: null };
  if (typeof v !== "string") return fail(`${field} must be text`);
  const t = v.trim();
  if (t.length > max) return fail(`${field} can be at most ${max} characters`);
  return { ok: true, value: t === "" ? null : t };
}

function kindOf(v: unknown): Result<RuleCriteria["kind"]> {
  if (v == null || v === "") return { ok: true, value: null };
  if (v === "CARD" || v === "SEALED") return { ok: true, value: v };
  return fail("kind must be CARD, SEALED, or empty for both");
}

function priceOf(v: unknown): Result<number> {
  if (typeof v !== "number" || !Number.isInteger(v)) return fail("maxPriceCents must be a whole number of cents");
  if (v <= 0) return fail("the price limit must be more than $0");
  if (v > MAX_RULE_PRICE_CENTS) return fail("that price limit is too high");
  return { ok: true, value: v };
}

export const ONLY_MISSING_NEEDS_CARDS = "“Only cards I don't own” works on cards, not sealed products.";

function flag(v: unknown, field: string): Result<boolean> {
  if (v == null) return { ok: true, value: false };
  if (typeof v !== "boolean") return fail(`${field} must be true or false`);
  return { ok: true, value: v };
}

export interface CreateWatchInput extends RuleCriteria {
  setSlug: string;
  /** null = use the generated description. */
  name: string | null;
}

export function parseCreate(body: unknown): Result<CreateWatchInput> {
  if (typeof body !== "object" || body == null) return fail("expected a JSON object");
  const b = body as Record<string, unknown>;

  if (typeof b.setSlug !== "string" || b.setSlug.trim() === "") return fail("setSlug is required");
  const kind = kindOf(b.kind);
  if (!kind.ok) return kind;
  const rarity = optionalText(b.rarity, "rarity", MAX_TEXT);
  if (!rarity.ok) return rarity;
  const query = optionalText(b.query, "query", MAX_TEXT);
  if (!query.ok) return query;
  const name = optionalText(b.name, "name", MAX_NAME);
  if (!name.ok) return name;
  const price = priceOf(b.maxPriceCents);
  if (!price.ok) return price;
  const onlyMissing = flag(b.onlyMissing, "onlyMissing");
  if (!onlyMissing.ok) return onlyMissing;
  if (onlyMissing.value && kind.value === "SEALED") return fail(ONLY_MISSING_NEEDS_CARDS);

  return {
    ok: true,
    value: {
      setSlug: b.setSlug.trim(),
      name: name.value,
      // Only cards can be "missing", so that choice settles what the rule is about.
      kind: onlyMissing.value ? "CARD" : kind.value,
      onlyMissing: onlyMissing.value,
      rarity: rarity.value,
      query: query.value,
      maxPriceCents: price.value,
    },
  };
}

export interface PatchWatchInput {
  criteria: Partial<RuleCriteria>;
  /** undefined = leave alone, null = regenerate the description. */
  name?: string | null;
  enabled?: boolean;
}

export function parsePatch(body: unknown): Result<PatchWatchInput> {
  if (typeof body !== "object" || body == null) return fail("expected a JSON object");
  const b = body as Record<string, unknown>;
  const out: PatchWatchInput = { criteria: {} };

  if ("kind" in b) {
    const kind = kindOf(b.kind);
    if (!kind.ok) return kind;
    out.criteria.kind = kind.value;
  }
  if ("rarity" in b) {
    const rarity = optionalText(b.rarity, "rarity", MAX_TEXT);
    if (!rarity.ok) return rarity;
    out.criteria.rarity = rarity.value;
  }
  if ("query" in b) {
    const query = optionalText(b.query, "query", MAX_TEXT);
    if (!query.ok) return query;
    out.criteria.query = query.value;
  }
  if ("maxPriceCents" in b) {
    const price = priceOf(b.maxPriceCents);
    if (!price.ok) return price;
    out.criteria.maxPriceCents = price.value;
  }
  if ("name" in b) {
    const name = optionalText(b.name, "name", MAX_NAME);
    if (!name.ok) return name;
    out.name = name.value;
  }
  if ("onlyMissing" in b) {
    if (typeof b.onlyMissing !== "boolean") return fail("onlyMissing must be true or false");
    out.criteria.onlyMissing = b.onlyMissing;
  }
  if ("enabled" in b) {
    if (typeof b.enabled !== "boolean") return fail("enabled must be true or false");
    out.enabled = b.enabled;
  }
  return { ok: true, value: out };
}
