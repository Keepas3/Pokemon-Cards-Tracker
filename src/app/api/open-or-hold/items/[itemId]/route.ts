import { NextResponse } from "next/server";
import { analyzeItem } from "@/lib/openOrHold/service";

/** Open or hold for one sealed row of a set (reads saved data only — no API requests). */
export async function GET(_req: Request, { params }: { params: Promise<{ itemId: string }> }) {
  const { itemId } = await params;
  const analysis = await analyzeItem(itemId);
  if (!analysis) return NextResponse.json({ error: "sealed product not found" }, { status: 404 });
  return NextResponse.json(analysis);
}
