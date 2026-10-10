import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireProfile } from "@/lib/auth/current";
import { tracksCard } from "@/lib/cards/tracking";
import { CardPriceProvider } from "@/generated/prisma/client";
import { safeHttpUrl } from "@/lib/security/urls";

interface AddSourceBody {
  provider?: CardPriceProvider;
  externalId?: string;
  variant?: string | null;
  priceCents?: number | null;
  lowPriceCents?: number | null;
  url?: string;
}

/** Attaches another provider's price source to an existing card (for cross-checking). */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireProfile();
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const body = (await req.json()) as AddSourceBody;

  if (!body.provider || !body.externalId || !body.url) {
    return NextResponse.json({ error: "provider, externalId, and url are required" }, { status: 400 });
  }
  if (!Object.values(CardPriceProvider).includes(body.provider)) {
    return NextResponse.json({ error: "invalid provider" }, { status: 400 });
  }

  const url = safeHttpUrl(body.url);
  if (!url || typeof body.externalId !== "string") {
    return NextResponse.json({ error: "url must be an http(s) link and externalId must be text" }, { status: 400 });
  }

  // Only a card on your own list (the shared card could otherwise be changed through anyone's session).
  const card = (await tracksCard(auth.profile.id, id)) ? await prisma.card.findUnique({ where: { id } }) : null;
  if (!card) {
    return NextResponse.json({ error: "card not found" }, { status: 404 });
  }

  try {
    const source = await prisma.cardPriceSource.create({
      data: {
        cardId: id,
        provider: body.provider,
        externalId: body.externalId,
        variant: body.variant || null,
        url,
        lastPriceCents: body.priceCents ?? null,
        lastLowPriceCents: body.lowPriceCents ?? null,
        lastCheckedAt: new Date(),
      },
    });
    return NextResponse.json({ source }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: "this provider + id is already tracked for another card, or another error occurred", detail: (err as Error).message },
      { status: 409 },
    );
  }
}
