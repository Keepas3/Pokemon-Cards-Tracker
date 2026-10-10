// Validation for the collection API. Pure, so the rules are testable without a request.

import { cardKey } from "./numbers";

export const MAX_QUANTITY = 9999;

export interface OwnedInput {
  setId: number;
  /** The card's number as shown ("025/088", "25" — anything cardKey understands). */
  number: string;
  /** The new total copies of this card, any printing (0 removes it). */
  quantity: number;
}

type Result<T> = { ok: true; value: T } | { ok: false; error: string };

export function parseOwned(body: unknown): Result<OwnedInput> {
  if (typeof body !== "object" || body == null) return { ok: false, error: "expected a JSON object" };
  const b = body as Record<string, unknown>;
  const isInt = (v: unknown): v is number => typeof v === "number" && Number.isInteger(v);

  if (!isInt(b.setId)) return { ok: false, error: "setId is required" };
  if (typeof b.number !== "string" || b.number.length > 40 || cardKey(b.number) == null) {
    return { ok: false, error: "number must be a card number like 025/088" };
  }
  if (!isInt(b.quantity) || b.quantity < 0 || b.quantity > MAX_QUANTITY) {
    return { ok: false, error: `quantity must be a whole number from 0 to ${MAX_QUANTITY}` };
  }
  return { ok: true, value: { setId: b.setId, number: b.number.trim(), quantity: b.quantity } };
}
