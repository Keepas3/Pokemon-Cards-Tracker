import { NextRequest, NextResponse } from "next/server";
import { loadSets } from "@/lib/sets/setsService";

/** All Pokémon sets, served from the SQLite cache and refreshed only when stale (or `?refresh=1`). */
export async function GET(req: NextRequest) {
  const refresh = req.nextUrl.searchParams.get("refresh") === "1";
  return NextResponse.json(await loadSets({ refresh }));
}
