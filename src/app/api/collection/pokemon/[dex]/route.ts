import { NextRequest, NextResponse } from "next/server";
import { requireProfile } from "@/lib/auth/current";
import { isDexId } from "@/lib/pokedex/species";
import { loadPokemon, setFollowed } from "@/lib/pokedex/service";

type Ctx = { params: Promise<{ dex: string }> };

/** Parses the Pokédex number in the URL; null unless it's a plain whole number that is a real Pokémon. */
async function dexOf({ params }: Ctx): Promise<number | null> {
  const { dex } = await params;
  const n = /^\d{1,4}$/.test(dex) ? Number(dex) : NaN;
  return isDexId(n) ? n : null;
}

/** Every card of one Pokémon across all sets, with what the signed-in person owns. */
export async function GET(_req: NextRequest, ctx: Ctx) {
  const auth = await requireProfile();
  if (!auth.ok) return auth.response;
  const dexId = await dexOf(ctx);
  if (dexId == null) return NextResponse.json({ error: "no such Pokémon" }, { status: 404 });
  const payload = await loadPokemon(auth.profile.id, dexId, { fetch: true });
  if (!payload) return NextResponse.json({ error: "no such Pokémon" }, { status: 404 });
  return NextResponse.json(payload);
}

/** Follow (or stop following) a Pokémon. Body: { followed: boolean }. */
export async function PUT(req: NextRequest, ctx: Ctx) {
  const auth = await requireProfile();
  if (!auth.ok) return auth.response;
  const dexId = await dexOf(ctx);
  if (dexId == null) return NextResponse.json({ error: "no such Pokémon" }, { status: 404 });
  const body = (await req.json().catch(() => null)) as { followed?: unknown } | null;
  if (typeof body?.followed !== "boolean") return NextResponse.json({ error: "followed must be true or false" }, { status: 400 });
  await setFollowed(auth.profile.id, dexId, body.followed);
  return NextResponse.json({ ok: true, followed: body.followed });
}
