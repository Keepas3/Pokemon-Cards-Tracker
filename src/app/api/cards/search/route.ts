import { NextRequest, NextResponse } from "next/server";
import { activeProviders, cardPriceCheckers } from "@/lib/cardPricing";

/**
 * Live card search on tcgapi.dev — nothing is stored here. With no API key configured
 * it returns zero candidates and a note, rather than failing.
 */
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim();
  if (!q) {
    return NextResponse.json({ error: "q is required" }, { status: 400 });
  }

  const results = await Promise.all(
    activeProviders.map(async (provider) => {
      const result = await cardPriceCheckers[provider]!.search(q);
      return { provider, result };
    }),
  );

  const candidates = results.flatMap(({ result }) => (result.ok ? result.candidates : []));
  const providerErrors = Object.fromEntries(
    results.filter(({ result }) => !result.ok).map(({ provider, result }) => [provider, (result as { error: string }).error]),
  );

  return NextResponse.json({ candidates, providerErrors });
}
