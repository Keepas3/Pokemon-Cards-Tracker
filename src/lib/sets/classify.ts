import { cardKey } from "@/lib/collection/numbers";

// tcgapi.dev files everything TCGplayer lists under "Cards" as a card — including
// collection boxes ("First Partner Illustration Collection"), code cards and
// unnumbered promos. This sorts rows into what a collector means by each word.
// Pure and client-safe.

export type ItemGroup = "card" | "sealed" | "other";

export interface Classifiable {
  /** What tcgapi.dev said it is. */
  kind: "CARD" | "SEALED";
  number: string | null;
  rarity: string | null;
  name: string;
}

/**
 * - **card** — a numbered card from the set (collectible, ownable).
 * - **sealed** — a sealed product: tcgapi's own "Sealed Products", plus the blank-rarity
 *   unnumbered "Cards" that are really boxes.
 * - **other** — code cards and unnumbered promos: priced, but neither a card you collect
 *   nor a product you open.
 */
export function classifyItem(item: Classifiable): ItemGroup {
  if (item.kind === "SEALED") return "sealed";
  if (/code card/i.test(item.rarity ?? "") || /^code card\b/i.test(item.name)) return "other";
  if (cardKey(item.number) != null) return "card";
  return (item.rarity ?? "").trim() === "" ? "sealed" : "other";
}
