import { NextResponse } from "next/server";
import { requireProfile } from "@/lib/auth/current";
import { loadPokemonGallery } from "@/lib/pokedex/service";

/** Every Pokémon in Pokédex order, with the signed-in person's progress on the ones they follow. */
export async function GET() {
  const auth = await requireProfile();
  if (!auth.ok) return auth.response;
  return NextResponse.json(await loadPokemonGallery(auth.profile.id));
}
