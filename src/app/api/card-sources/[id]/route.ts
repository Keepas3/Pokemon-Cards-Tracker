import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireProfile } from "@/lib/auth/current";

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireProfile();
  if (!auth.ok) return auth.response;
  const { id } = await params;
  // Only a source of a card on your own list.
  const removed = await prisma.cardPriceSource.deleteMany({
    where: { id, card: { watchlistEntries: { some: { profileId: auth.profile.id } } } },
  });
  if (removed.count === 0) return NextResponse.json({ error: "card price source not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
