// Which Pokémon a card is, from its name ("Alolan Vulpix", "Mega Charizard X ex", "Lillie's Clefairy ex").
// Used to count the cards a person owns per Pokémon without fetching each Pokémon's list first.
// Pure.

import { SPECIES_NAMES } from "./species";

const normalize = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/♀/g, " f")
    .replace(/♂/g, " m")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const MAX_WORDS = 3;

let byName: Map<string, number> | null = null;
function table(): Map<string, number> {
  if (!byName) {
    byName = new Map();
    SPECIES_NAMES.forEach((name, i) => {
      const key = normalize(name);
      // Nidoran♀/♂ normalize to "nidoran f"/"nidoran m", so they stay distinct.
      if (!byName!.has(key)) byName!.set(key, i + 1);
    });
  }
  return byName;
}

/** The Pokédex number of the Pokémon named in a card name, preferring the longest species name; null for trainers, energy, etc. */
export function dexIdFromCardName(cardName: string): number | null {
  const words = normalize(cardName).split(" ").filter(Boolean);
  const names = table();
  for (let size = Math.min(MAX_WORDS, words.length); size >= 1; size--) {
    for (let start = 0; start + size <= words.length; start++) {
      const hit = names.get(words.slice(start, start + size).join(" "));
      if (hit != null) return hit;
    }
  }
  return null;
}
