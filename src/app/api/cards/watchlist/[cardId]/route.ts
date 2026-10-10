import { NextRequest, NextResponse } from "next/server";
import { requireProfile } from "@/lib/auth/current";
import { setThreshold } from "@/lib/cards/tracking";

interface UpdateWatchlistBody {
  thresholdCents?: number;
}

/** Changes the price alert on one of the signed-in person's cards. */
export async function PUT(req: NextRequest, { params }: { params: Promise<{ cardId: string }> }) {
  const auth = await requireProfile();
  if (!auth.ok) return auth.response;
  const { cardId } = await params;
  const body = (await req.json().catch(() => null)) as UpdateWatchlistBody | null;

  if (typeof body?.thresholdCents !== "number" || !Number.isFinite(body.thresholdCents) || body.thresholdCents < 0) {
    return NextResponse.json({ error: "thresholdCents must be a non-negative number" }, { status: 400 });
  }

  const entry = await setThreshold(auth.profile.id, cardId, Math.round(body.thresholdCents));
  if (!entry) return NextResponse.json({ error: "not on your list" }, { status: 404 });
  return NextResponse.json({ entry });
}

/** Removes the price alert; the card stays on the person's list. */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ cardId: string }> }) {
  const auth = await requireProfile();
  if (!auth.ok) return auth.response;
  const { cardId } = await params;
  const entry = await setThreshold(auth.profile.id, cardId, null);
  if (!entry) return NextResponse.json({ error: "not on your list" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
