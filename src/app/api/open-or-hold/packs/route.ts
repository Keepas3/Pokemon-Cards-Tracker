import { NextRequest, NextResponse } from "next/server";
import { parsePackCount } from "@/lib/openOrHold/input";
import { savePackCount } from "@/lib/openOrHold/service";

/** Sets how many packs a sealed product holds; `packs: null` goes back to the default. */
export async function PUT(req: NextRequest) {
  const parsed = parsePackCount(await req.json().catch(() => null));
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  if (!(await savePackCount(parsed.value))) return NextResponse.json({ error: "set not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
