import { NextRequest, NextResponse } from "next/server";
import { requireProfile } from "@/lib/auth/current";
import { watchSetItem } from "@/lib/sets/setsService";

/** Watch a card from a set page: finds/creates the tracked Card, then sets this person's price threshold. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ itemId: string }> }) {
  const auth = await requireProfile();
  if (!auth.ok) return auth.response;
  const { itemId } = await params;
  const body = (await req.json().catch(() => ({}))) as { thresholdCents?: number };

  if (typeof body.thresholdCents !== "number" || !Number.isFinite(body.thresholdCents) || body.thresholdCents < 0) {
    return NextResponse.json({ error: "thresholdCents must be a non-negative number" }, { status: 400 });
  }

  const result = await watchSetItem(auth.profile.id, itemId, Math.round(body.thresholdCents));
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json({ cardId: result.cardId }, { status: 201 });
}
