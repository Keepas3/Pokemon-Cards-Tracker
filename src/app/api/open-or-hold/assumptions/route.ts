import { NextRequest, NextResponse } from "next/server";
import { parseAssumptions } from "@/lib/openOrHold/input";
import { loadAssumptions, saveAssumptions } from "@/lib/openOrHold/service";

export async function GET() {
  return NextResponse.json({ assumptions: await loadAssumptions() });
}

/** Changes the fee, bulk cut-off and bulk-per-pack values every result is built on. */
export async function PUT(req: NextRequest) {
  const parsed = parseAssumptions(await req.json().catch(() => null));
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  return NextResponse.json({ assumptions: await saveAssumptions(parsed.value) });
}
