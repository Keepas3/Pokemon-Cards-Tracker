import { NextRequest, NextResponse } from "next/server";
import { requireProfile } from "@/lib/auth/current";
import { listTrackedCards, setThreshold, tracksCard } from "@/lib/cards/tracking";

/** Cards on the signed-in person's list that have a price alert. */
export async function GET() {
  const auth = await requireProfile();
  if (!auth.ok) return auth.response;
  return NextResponse.json({ watchlist: await listTrackedCards(auth.profile.id, { alertsOnly: true }) });
}

interface AddToWatchlistBody {
  cardId?: string;
  thresholdCents?: number;
}

/** Sets a price alert on a card that's on the person's list. */
export async function POST(req: NextRequest) {
  const auth = await requireProfile();
  if (!auth.ok) return auth.response;

  const body = (await req.json().catch(() => null)) as AddToWatchlistBody | null;
  if (typeof body?.cardId !== "string" || typeof body.thresholdCents !== "number" || !Number.isFinite(body.thresholdCents)) {
    return NextResponse.json({ error: "cardId and thresholdCents are required" }, { status: 400 });
  }
  if (body.thresholdCents < 0) {
    return NextResponse.json({ error: "thresholdCents must be >= 0" }, { status: 400 });
  }

  if (!(await tracksCard(auth.profile.id, body.cardId))) {
    return NextResponse.json({ error: "card not found" }, { status: 404 });
  }
  const entry = await setThreshold(auth.profile.id, body.cardId, Math.round(body.thresholdCents));
  return NextResponse.json({ entry }, { status: 201 });
}
