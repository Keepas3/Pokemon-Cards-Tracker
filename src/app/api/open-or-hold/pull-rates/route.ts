import { NextRequest, NextResponse } from "next/server";
import { parsePullRate } from "@/lib/openOrHold/input";
import { savePullRate } from "@/lib/openOrHold/service";

/** Sets your own per-pack rate for a rarity in a set; `perPack: null` goes back to the published figure. */
export async function PUT(req: NextRequest) {
  const parsed = parsePullRate(await req.json().catch(() => null));
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  if (!(await savePullRate(parsed.value))) return NextResponse.json({ error: "set not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
