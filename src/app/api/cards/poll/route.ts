import { NextResponse } from "next/server";
import { pollAllCardPrices } from "@/lib/cardPoller";

/** Manually trigger a price check of every tracked card price source right now. */
export async function POST() {
  const results = await pollAllCardPrices();
  return NextResponse.json({ results });
}
