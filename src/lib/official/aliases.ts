// Sets whose tcgapi.dev name differs too much from the official catalog's for
// automatic matching: our set's slug → the official set id. Each pairing was
// checked by hand against the catalog's own set list. Extend it when a set you
// care about shows up under "Other sets" in the Collection gallery.
//
// Left out on purpose: trainer kits (tcgapi.dev has one set per pair of decks, the
// catalog one set per deck), Trick or Trade, Battle Academy, Prize Packs, Southeast
// Asia Exclusives and similar odds and ends the catalog doesn't list as sets.
export const SET_ALIASES: Record<string, string> = {
  // Mega Evolution
  "mee-mega-evolution-energies": "mee",
  "me-mega-evolution-promo": "mep",
  // Scarlet & Violet
  "sv01-scarlet-and-violet-base-set": "sv01",
  "sv-scarlet-and-violet-151": "sv03.5",
  "sve-scarlet-and-violet-energies": "sve",
  "sv-scarlet-and-violet-promo-cards": "svp",
  // Sword & Shield
  "swsh01-sword-and-shield-base-set": "swsh1",
  "swsh-sword-and-shield-promo-cards": "swshp",
  // Sun & Moon, XY, Black & White, HeartGold & SoulSilver, Diamond & Pearl, older
  "sm-base-set": "sm1",
  "sm-promos": "smp",
  "xy-base-set": "xy1",
  "xy-promos": "xyp",
  "black-and-white-promos": "bwp",
  "legendary-treasures-radiant-collection": "rc",
  "hgss-promos": "hgssp",
  "diamond-and-pearl-promos": "dpp",
  rumble: "ru1",
  expedition: "ecard1",
  "wotc-promo": "basep",
  // McDonald's collections
  "mcdonalds-promos-2011": "2011bw",
  "mcdonalds-promos-2012": "2012bw",
  "mcdonalds-promos-2014": "2014xy",
  "mcdonalds-promos-2015": "2015xy",
  "mcdonalds-promos-2016": "2016xy",
  "mcdonalds-promos-2017": "2017sm",
  "mcdonalds-promos-2018": "2018sm",
  "mcdonalds-promos-2019": "2019sm",
  "mcdonalds-25th-anniversary-promos": "2021swsh",
  "mcdonalds-promos-2022": "2022swsh",
  "mcdonalds-promos-2023": "2023sv",
  "mcdonalds-promos-2024": "2024sv",
};
