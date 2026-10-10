import { NextRequest, NextResponse } from "next/server";
import { CardPriceProvider } from "@/generated/prisma/client";
import { requireProfile } from "@/lib/auth/current";
import { listTrackedCards, trackCard } from "@/lib/cards/tracking";
import { safeHttpUrl } from "@/lib/security/urls";

/** The cards on the signed-in person's list. */
export async function GET() {
  const auth = await requireProfile();
  if (!auth.ok) return auth.response;
  return NextResponse.json({ cards: await listTrackedCards(auth.profile.id) });
}

interface CreateCardBody {
  name: string;
  setName: string;
  number?: string;
  imageUrl?: string;
  provider: CardPriceProvider;
  externalId: string;
  variant?: string | null;
  priceCents?: number | null;
  lowPriceCents?: number | null;
  url: string;
}

/** Adds a card to the list from one chosen search candidate (creating its first price source if nobody tracks it yet). */
export async function POST(req: NextRequest) {
  const auth = await requireProfile();
  if (!auth.ok) return auth.response;

  const body = (await req.json().catch(() => null)) as Partial<CreateCardBody> | null;
  if (!body || !body.name || !body.setName || !body.provider || !body.externalId || !body.url) {
    return NextResponse.json({ error: "name, setName, provider, externalId, and url are required" }, { status: 400 });
  }
  if (!Object.values(CardPriceProvider).includes(body.provider)) {
    return NextResponse.json({ error: "invalid provider" }, { status: 400 });
  }
  const url = safeHttpUrl(body.url);
  const imageUrl = body.imageUrl ? safeHttpUrl(body.imageUrl) : null;
  if (!url || (body.imageUrl && !imageUrl) || typeof body.externalId !== "string") {
    return NextResponse.json({ error: "url and imageUrl must be http(s) links, and externalId must be text" }, { status: 400 });
  }

  try {
    const card = await trackCard(auth.profile.id, {
      name: body.name,
      setName: body.setName,
      number: body.number || null,
      imageUrl,
      provider: body.provider,
      externalId: body.externalId,
      variant: body.variant || null,
      priceCents: body.priceCents ?? null,
      lowPriceCents: body.lowPriceCents ?? null,
      url,
    });
    return NextResponse.json({ card }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
