import Segmented from "./ui/Segmented";

/** The ways into the collection: by set, by Pokémon, and the deals on what you're missing. */
export default function CollectionTabs({ active }: { active: "sets" | "pokemon" | "deals" }) {
  return (
    <Segmented
      label="Collect by"
      value={active}
      items={[
        { key: "sets", label: "Sets", href: "/collection" },
        { key: "pokemon", label: "Pokémon", href: "/collection/pokemon" },
        { key: "deals", label: "Deals", href: "/collection/deals" },
      ]}
    />
  );
}
