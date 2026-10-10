import { NextRequest, NextResponse } from "next/server";
import { requireProfile } from "@/lib/auth/current";
import { DEFAULT_THRESHOLDS } from "@/lib/deals/compute";
import { loadDeals } from "@/lib/deals/service";
import type { DealScope } from "@/lib/deals/types";

/** The unit of `minPct`: whole percent in the query string, 0–1 inside. */
const clamp = (n: number, lo: number, hi: number) => Math.min(Math.max(n, lo), hi);

/**
 * Cards the signed-in person is missing that are listed well under their market price.
 * `?scope=mine|all`, `?minPct=25` (percent off), `?minSavings=2` (dollars), `?limit=60`.
 */
export async function GET(req: NextRequest) {
  const auth = await requireProfile();
  if (!auth.ok) return auth.response;

  const q = req.nextUrl.searchParams;
  const scope: DealScope = q.get("scope") === "all" ? "all" : "mine";
  const num = (name: string) => {
    const v = Number(q.get(name));
    return q.get(name) != null && q.get(name) !== "" && Number.isFinite(v) ? v : null;
  };
  const minPct = num("minPct");
  const minSavings = num("minSavings");

  const payload = await loadDeals(auth.profile.id, {
    scope,
    limit: num("limit") ?? undefined,
    thresholds: {
      minPct: minPct == null ? DEFAULT_THRESHOLDS.minPct : clamp(minPct / 100, 0.05, 0.95),
      minSavingsCents: minSavings == null ? DEFAULT_THRESHOLDS.minSavingsCents : clamp(Math.round(minSavings * 100), 50, 100_000),
    },
  });
  return NextResponse.json(payload);
}
