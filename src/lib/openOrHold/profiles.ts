// Published pull rates, per set. Every number here comes from a TCGplayer
// Authentication Center study (Peter Day, tcgplayer.com): the share of opened
// packs that contained a card of that rarity. They're measured samples with a
// 95% confidence range, not official odds — The Pokémon Company doesn't publish
// any. Each study assumes every card within a rarity is equally likely, which
// is how a specific card's odds are derived; so does the calculator.
//
// Rates are fractions of packs (0.2091 = 20.91%). Slot positions are from the
// same articles ("a Double Rare in the Rare slot", "an Illustration Rare in the
// second Reverse Holo slot"). Cards in different slots can appear in the same
// pack; cards within one slot can't.
//
// A set with no study here has no default profile: the panel says so and asks
// you to enter rates instead of guessing. (ME06: Delta Reign has none yet.)

import type { HitDef, ProfileSource, PullProfile, SlotDef } from "./types";

const ARTICLE = "https://www.tcgplayer.com/content/article/";

const hit = (rarity: string, perPack: number | null, poolSet?: string): HitDef => ({ rarity, perPack, poolSet });
const slot = (label: string, ...hits: HitDef[]): SlotDef => ({ label, hits });

const EQUAL_POPULATION = "TCGplayer assumes each card within a rarity is equally likely; so does this calculator.";
const SAMPLE_NOT_OFFICIAL = "Measured from opened packs (95% confidence ranges are in the source) — not official odds.";

/**
 * Mega Evolution Series main sets share one layout: the Rare slot holds a Double
 * Rare, Ultra Rare (or Mega Hyper Rare); the second Reverse Holo slot holds an
 * Illustration Rare or Special Illustration Rare. The Mega Hyper Rare's slot
 * isn't stated in the articles; it's placed in the Rare slot, which only
 * matters for the tiny chance of it sharing a pack with a Double Rare.
 */
function megaSeries(
  id: string,
  setNames: string[],
  source: ProfileSource,
  r: { dr: number; ur: number; ir: number; sir: number; mhr: number },
  extra: { rareSlot?: HitDef[]; notes?: string[] } = {},
): PullProfile {
  return {
    id,
    setNames,
    slots: [
      slot(
        "Rare slot",
        hit("Double Rare", r.dr),
        hit("Ultra Rare", r.ur),
        ...(extra.rareSlot ?? []),
        hit("Mega Hyper Rare", r.mhr),
      ),
      slot("Second Reverse Holo slot", hit("Illustration Rare", r.ir), hit("Special Illustration Rare", r.sir)),
    ],
    source,
    notes: [SAMPLE_NOT_OFFICIAL, EQUAL_POPULATION, ...(extra.notes ?? [])],
  };
}

export const PROFILES: PullProfile[] = [
  // 5,000+ packs. DR 20.91% ±1.12, UR 8.23% ±0.76, IR 10.89% ±0.86, SIR 0.99% ±0.27, MHR 0.08% ±0.08.
  megaSeries(
    "me01",
    ["ME01: Mega Evolution"],
    {
      title: "Pokémon TCG: Mega Evolution Pull Rates",
      url: `${ARTICLE}Pok%C3%A9mon-TCG-Mega-Evolution-Pull-Rates/40cbeedc-21ce-473b-aef1-74e3969d9f91/`,
      published: "2025-09-30",
      packsOpened: "5,000+",
    },
    { dr: 0.2091, ur: 0.0823, ir: 0.1089, sir: 0.0099, mhr: 0.0008 },
  ),

  // 5,000+ packs. DR 20.77% ±1.12, UR 8.06% ±0.75, IR 10.97% ±0.86, SIR 1.25% ±0.31, MHR 0.08% ±0.08.
  megaSeries(
    "me02",
    ["ME02: Phantasmal Flames"],
    {
      title: "Pokémon TCG: Phantasmal Flames Pull Rates",
      url: `${ARTICLE}Pok%C3%A9mon-TCG-Phantasmal-Flames-Pull-Rates/9abae60d-b7fb-448f-874e-176f78d6a6ca/`,
      published: "2026-02-24",
      packsOpened: "5,000+",
    },
    { dr: 0.2077, ur: 0.0806, ir: 0.1097, sir: 0.0125, mhr: 0.0008 },
  ),

  // 3,500+ packs. DR 20.97% ±1.34, UR 8.54% ±0.92, IR 11.20% ±1.03, SIR 1.23% ±0.36, MHR 0.06% ±0.08
  // (the MHR interval is wider than the estimate: it may well be higher).
  megaSeries(
    "me03",
    ["ME03: Perfect Order"],
    {
      title: "Pokémon TCG: Perfect Order Pull Rates",
      url: `${ARTICLE}Pok%C3%A9mon-TCG-Perfect-Order-Pull-Rates/73148119-ebcb-40b7-84b6-52b3a6d0c631/`,
      published: "2026-04-03",
      packsOpened: "3,500+",
    },
    { dr: 0.2097, ur: 0.0854, ir: 0.112, sir: 0.0123, mhr: 0.0006 },
    {
      notes: [
        "The Mega Hyper Rare figure (0.06% ±0.08%) is smaller than its own margin of error — treat it as very uncertain.",
      ],
    },
  ),

  // 8,500+ packs. DR 20.30% ±0.85, UR 8.29% ±0.58, IR 10.66% ±0.65, SIR 1.21% ±0.23, MHR 0.10% ±0.07.
  megaSeries(
    "me04",
    ["ME04: Chaos Rising"],
    {
      title: "Pokémon TCG: Chaos Rising Pull Rates",
      url: `${ARTICLE}Pok%C3%A9mon-TCG-Chaos-Rising-Pull-Rates/304e8bfc-175a-4d31-93fe-5bb1be11e5d2/`,
      published: "2026-06-04",
      packsOpened: "8,500+",
    },
    { dr: 0.203, ur: 0.0829, ir: 0.1066, sir: 0.0121, mhr: 0.001 },
  ),

  // 4,000+ packs. DR 21.02% ±1.21, UR 8.30% ±0.82, IR 11.01% ±0.93, SIR 1.25% ±0.33, MHR 0.09% ±0.09.
  megaSeries(
    "me05",
    ["ME05: Pitch Black"],
    {
      title: "Pokémon TCG: Pitch Black Pull Rates",
      url: `${ARTICLE}Pok%C3%A9mon-TCG-Pitch-Black-Pull-Rates/069a5fda-2d1f-44a1-97de-b6dcdc5abfb8/`,
      published: "2026-07-21",
      packsOpened: "4,000+",
    },
    { dr: 0.2102, ur: 0.083, ir: 0.1101, sir: 0.0125, mhr: 0.0009 },
  ),

  // 2,000+ packs, opened after the ETBs released. A new Mega Attack Rare takes the
  // place of an Ultra Rare in the Rare slot (UR fell from ~8% to ~5%).
  // DR 20.37% ±1.70, UR 4.81% ±0.90, MAR 3.47% ±0.77, IR 11.25% ±1.33, SIR 1.44% ±0.50, MHR 0.19% ±0.18.
  // The article's per-rarity Ultra Rare table says "20.77%" next to "1 in 21" and ±0.90 — a typo for the
  // 4.81% in its summary table, which is what's used here.
  megaSeries(
    "ascended-heroes",
    ["ME: Ascended Heroes"],
    {
      title: "Pokémon TCG: Ascended Heroes Pull Rates",
      url: `${ARTICLE}Pok%C3%A9mon-TCG-Ascended-Heroes-Pull-Rates/60143d94-88a7-42ce-8e73-babd7b3fabd6/`,
      published: "2026-02-24",
      packsOpened: "2,000+",
    },
    { dr: 0.2037, ur: 0.0481, ir: 0.1125, sir: 0.0144, mhr: 0.0019 },
    {
      rareSlot: [hit("Mega Attack Rare", 0.0347)],
      notes: [
        "God Packs (three Mega Attack Rares and seven Special Illustration Rares) exist, but none turned up in the sample, so they aren't counted.",
      ],
    },
  ),

  // 3,000+ packs of 5 cards. Slot positions as the article gives them: Illustration Rare and
  // Classic Collection in the third slot; Double Rare, Special Illustration Rare and Futuristic Rare
  // in the fourth; a Pikachu Rare is guaranteed in the last slot.
  // DR 21.02% ±1.21, IR 19.72% ±1.37, Classic Collection 10.15% ±1.04, SIR 4.88% ±0.74,
  // Futuristic Rare 0.83% ±0.31, RGB Rare: none found in 3,000+ packs, so no figure.
  {
    id: "30th-celebration",
    setNames: ["ME: 30th Celebration"],
    slots: [
      slot(
        "Third slot",
        hit("Illustration Rare", 0.1972),
        // The 30 Classic Collection cards are their own tcgapi.dev set.
        hit("Classic Collection", 0.1015, "ME: 30th Celebration Classic Collection"),
      ),
      slot(
        "Fourth slot",
        hit("Double Rare", 0.2102),
        hit("Special Illustration Rare", 0.0488),
        hit("Futuristic Rare", 0.0083),
      ),
      // Guaranteed by the article. Which of the 30 Pikachu cards you get is assumed uniform.
      slot("Last slot", hit("Pikachu Rare", 1)),
      // No rate: TCGplayer found none in 3,000+ packs. Listed so it can be seen and filled in.
      slot("Not found in the sample", hit("RGB Rare", null)),
    ],
    source: {
      title: "Pokémon TCG: 30th Celebration Pull Rates",
      url: `${ARTICLE}Pok%C3%A9mon-TCG-30th-Celebration-Pull-Rates/587b3657-481a-4ab8-827c-68cd3ab585b0/`,
      published: "2026-09-24",
      packsOpened: "3,000+",
    },
    notes: [
      SAMPLE_NOT_OFFICIAL,
      EQUAL_POPULATION,
      "The three RGB Rare Mew cards (worth thousands) have no published rate — TCGplayer found none in 3,000+ packs — so they are NOT counted unless you enter a rate under Pull rates.",
      "Which Pikachu Rare you get in the last slot is assumed to be uniform across the 30 — the article doesn't say.",
    ],
  },

  // 1,500+ packs. Foil Energy 24.83% (a basic energy; worth nothing here), DR 13.28% ±1.57,
  // UR 6.44% ±1.13, IR 8.50% ±1.29, SIR 3.11% ±0.80, Hyper Rare 1.94% ±0.64.
  {
    id: "sv-151",
    setNames: ["SV: Scarlet & Violet 151"],
    slots: [
      slot("Rare slot", hit("Double Rare", 0.1328), hit("Ultra Rare", 0.0644)),
      slot(
        "Second Reverse Holo slot",
        hit("Illustration Rare", 0.085),
        hit("Special Illustration Rare", 0.0311),
        hit("Hyper Rare", 0.0194),
      ),
    ],
    source: {
      title: "Pokémon TCG: Scarlet & Violet—151 Pull Rates",
      url: `${ARTICLE}Pok%C3%A9mon-TCG-Scarlet-Violet%E2%80%94151-Pull-Rates/b237df74-fbb0-40d0-9e13-d69ee6e804d9/`,
      published: "2025-02-27",
      packsOpened: "1,500+",
    },
    notes: [
      SAMPLE_NOT_OFFICIAL,
      EQUAL_POPULATION,
      "151's God Packs (a full evolution line in Illustration and Special Illustration Rares) are rare enough that TCGplayer says they don't meaningfully change the odds; they aren't modelled separately.",
      "The foil Energy card (about 1 pack in 4) is treated as bulk.",
    ],
  },
];

/** Same normalisation the matcher uses, so "ME: 30th Celebration" finds its profile whatever the case or punctuation. */
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/** The published profile for a tcgapi.dev set name, if there is one. */
export function findProfile(setName: string): PullProfile | null {
  const key = norm(setName);
  return PROFILES.find((p) => p.setNames.some((n) => norm(n) === key)) ?? null;
}
