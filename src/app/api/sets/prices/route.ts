import { NextRequest, NextResponse } from "next/server";
import { MAX_PRICE_LOAD, loadPricesForSets } from "@/lib/sets/setsService";

/**
 * Fetches saved prices for a few sets that don't have any yet (so their cards
 * can show a price range). Spends API requests, so the batch is capped.
 * Body: { slugs: string[] (in the order the user sees them), limit?: number }
 */
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { slugs?: unknown; limit?: unknown };

  if (!Array.isArray(body.slugs) || body.slugs.length === 0 || !body.slugs.every((s) => typeof s === "string")) {
    return NextResponse.json({ error: "slugs must be a non-empty array of set slugs" }, { status: 400 });
  }
  if (body.slugs.length > 500) {
    return NextResponse.json({ error: "too many slugs" }, { status: 400 });
  }

  const limit = typeof body.limit === "number" && Number.isFinite(body.limit) ? body.limit : MAX_PRICE_LOAD;
  return NextResponse.json(await loadPricesForSets(body.slugs as string[], limit));
}
