import { notFound } from "next/navigation";
import PokemonSpecies from "@/components/PokemonSpecies";
import { isDexId, speciesName } from "@/lib/pokedex/species";

function parse(dex: string): number | null {
  const n = /^\d{1,4}$/.test(dex) ? Number(dex) : NaN;
  return isDexId(n) ? n : null;
}

export async function generateMetadata({ params }: { params: Promise<{ dex: string }> }) {
  const dexId = parse((await params).dex);
  return { title: dexId ? `${speciesName(dexId)} · Collect by Pokémon` : "Pokémon" };
}

export default async function PokemonSpeciesPage({ params }: { params: Promise<{ dex: string }> }) {
  const dexId = parse((await params).dex);
  if (dexId == null) notFound();
  return <PokemonSpecies dexId={dexId} />;
}
