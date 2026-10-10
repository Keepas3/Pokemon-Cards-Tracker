import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireProfile } from "@/lib/auth/current";

/** Recent price changes on the cards the signed-in person tracks. */
export async function GET(req: NextRequest) {
  const auth = await requireProfile();
  if (!auth.ok) return auth.response;
  const limit = Math.min(Math.max(Number(req.nextUrl.searchParams.get("limit") ?? 50) || 50, 1), 200);
  const events = await prisma.cardPriceEvent.findMany({
    where: { cardPriceSource: { card: { watchlistEntries: { some: { profileId: auth.profile.id } } } } },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: { cardPriceSource: { include: { card: true } } },
  });
  return NextResponse.json({ events });
}
