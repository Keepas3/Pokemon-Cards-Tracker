"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { formatDate } from "@/lib/labels";
import { summarize } from "@/lib/collection/progress";
import type { CollectionCard } from "@/lib/collection/progress";
import type { PokemonCardDTO, PokemonPayload } from "@/lib/pokedex/types";
import { useApi } from "@/lib/useApi";
import { CardGrid, CardList } from "./CardGrid";
import SetCompletion from "./SetCompletion";
import EmptyState from "./ui/EmptyState";
import Icon from "./ui/Icon";
import PageHeader from "./ui/PageHeader";
import Segmented from "./ui/Segmented";

const PAGE_SIZE = 120;
type Layout = "grid" | "list";
type Order = "newest" | "oldest" | "price_desc" | "price_asc";
const ORDER_LABELS: Record<Order, string> = {
  newest: "Newest set first",
  oldest: "Oldest set first",
  price_desc: "Price: High to Low",
  price_asc: "Price: Low to High",
};

const pad = (n: number) => String(n).padStart(3, "0");

export default function PokemonSpecies({ dexId }: { dexId: number }) {
  const { data, error, loading } = useApi<PokemonPayload>(`/api/collection/pokemon/${dexId}`);
  const [layout, setLayout] = useState<Layout>("grid");
  const [order, setOrder] = useState<Order>("newest");
  const [query, setQuery] = useState("");
  const [missingOnly, setMissingOnly] = useState(false);
  const [limit, setLimit] = useState(PAGE_SIZE);
  const [edits, setEdits] = useState<Record<string, number>>({});
  const [followedOverride, setFollowedOverride] = useState<boolean | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  // The cards, with any change made on this page applied at once.
  const cards = useMemo<PokemonCardDTO[]>(
    () => (data?.cards ?? []).map((c) => (edits[c.key] === undefined ? c : { ...c, owned: edits[c.key] })),
    [data, edits],
  );
  // Completion is recomputed here as you tick cards off (the same sums the server uses).
  const summary = useMemo(() => summarize(cards as CollectionCard[], "official"), [cards]);
  const followed = followedOverride ?? data?.followed ?? false;

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = cards.filter((c) => {
      if (missingOnly && c.owned > 0) return false;
      if (q && !c.name.toLowerCase().includes(q) && !c.setName.toLowerCase().includes(q) && !c.number.toLowerCase().includes(q)) return false;
      return true;
    });
    const price = (c: PokemonCardDTO) => c.priceCents;
    const byPrice = (dir: number) => (a: PokemonCardDTO, b: PokemonCardDTO) => {
      if (price(a) == null && price(b) == null) return 0;
      if (price(a) == null) return 1;
      if (price(b) == null) return -1;
      return (price(a)! - price(b)!) * dir;
    };
    if (order === "oldest") return [...list].reverse();
    if (order === "price_desc") return [...list].sort(byPrice(-1));
    if (order === "price_asc") return [...list].sort(byPrice(1));
    return list;
  }, [cards, query, missingOnly, order]);

  async function follow(next: boolean): Promise<void> {
    setFollowedOverride(next);
    const res = await fetch(`/api/collection/pokemon/${dexId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ followed: next }),
    }).catch(() => null);
    if (!res?.ok) setFollowedOverride(!next);
  }

  /** Saves a new total of copies; the page updates at once and rolls back if the save fails. */
  async function saveOwned(card: PokemonCardDTO, quantity: number) {
    if (card.setId == null) return;
    const previous = cards.find((c) => c.key === card.key)?.owned ?? 0;
    setEdits((e) => ({ ...e, [card.key]: quantity }));
    setSaveError(null);
    try {
      const res = await fetch("/api/collection/items", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ setId: card.setId, number: card.number, quantity }),
      });
      if (res.ok) {
        // Owning something here means you're collecting this Pokémon: keep it on your list.
        if (!followed && quantity > 0) void follow(true);
        return;
      }
      setSaveError((await res.json().catch(() => ({}))).error ?? "Couldn't save that change.");
    } catch (err) {
      setSaveError((err as Error).message);
    }
    setEdits((e) => ({ ...e, [card.key]: previous }));
  }

  const back = { href: "/collection/pokemon", label: "All Pokémon" };

  if (!data) {
    return (
      <>
        <PageHeader back={back} title={loading ? "Loading…" : "Couldn't load this Pokémon"} />
        {!loading && <p className="text-sm text-warn">{error ?? "Something went wrong."}</p>}
        {loading && <p className="text-sm text-muted">Fetching every card of this Pokémon…</p>}
      </>
    );
  }

  const onChange = (c: CollectionCard, q: number) => void saveOwned(c as PokemonCardDTO, q);

  return (
    <div className="space-y-5">
      <PageHeader
        back={back}
        title={
          <span className="flex flex-wrap items-baseline gap-x-3">
            {data.name} <span className="num text-base font-normal text-subtle">#{pad(data.dexId)}</span>
          </span>
        }
        description={
          <span className="flex flex-wrap items-center gap-1.5">
            {data.generation != null && <span className="chip">Generation {data.generation}</span>}
            <span className="chip">{cards.length} cards you can track</span>
            {data.fetchedAt && <span className="chip">List from {formatDate(data.fetchedAt)}</span>}
          </span>
        }
        actions={
          <button onClick={() => void follow(!followed)} aria-pressed={followed} className={`btn ${followed ? "border-accent bg-accent-soft text-accent-text" : "btn-primary"}`}>
            <Icon name={followed ? "check" : "plus"} /> {followed ? "Following" : "Follow"}
          </button>
        }
      />

      {data.error && <p className="rounded-lg border border-warn/30 bg-warn-soft px-3 py-2 text-xs text-warn">{data.error}</p>}

      {cards.length > 0 ? (
        <section className="card space-y-4 p-4" aria-label={`Your ${data.name} collection`}>
          <SetCompletion summary={summary} cards={cards as CollectionCard[]} />
          {saveError && <p className="text-xs text-bad">{saveError}</p>}
        </section>
      ) : (
        <EmptyState title={`No ${data.name} cards to track yet.`}>
          {data.untracked.length > 0
            ? "Its cards are all in sets that can't be tracked yet (see below)."
            : "The card catalog doesn't list any cards for this Pokémon yet."}
        </EmptyState>
      )}

      {cards.length > 0 && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <label className="flex cursor-pointer items-center gap-1.5 text-sm text-muted">
              <input
                type="checkbox"
                checked={missingOnly}
                onChange={(e) => {
                  setMissingOnly(e.target.checked);
                  setLimit(PAGE_SIZE);
                }}
                className="accent-[var(--accent)]"
              />
              Missing only
            </label>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Icon name="search" className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
                <input
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setLimit(PAGE_SIZE);
                  }}
                  placeholder="Card, set or number"
                  aria-label="Search these cards"
                  className="input w-44 pl-8"
                />
              </div>
              <select value={order} onChange={(e) => setOrder(e.target.value as Order)} aria-label="Order" className="input">
                {(Object.keys(ORDER_LABELS) as Order[]).map((o) => (
                  <option key={o} value={o}>
                    {ORDER_LABELS[o]}
                  </option>
                ))}
              </select>
              <Segmented
                label="Layout"
                value={layout}
                onChange={setLayout}
                items={[
                  { key: "grid", label: "Grid" },
                  { key: "list", label: "List" },
                ]}
              />
            </div>
          </div>

          {shown.length === 0 ? (
            <EmptyState title={missingOnly ? "Nothing missing that matches — nice." : "Nothing matches that."} />
          ) : (
            <>
              {layout === "grid" ? <CardGrid cards={shown.slice(0, limit)} onChange={onChange} /> : <CardList cards={shown.slice(0, limit)} onChange={onChange} />}
              {shown.length > limit && (
                <button onClick={() => setLimit((l) => l + PAGE_SIZE)} className="btn w-full border-dashed">
                  Show {Math.min(PAGE_SIZE, shown.length - limit)} more ({shown.length - limit} remaining)
                </button>
              )}
            </>
          )}
        </>
      )}

      {data.untracked.length > 0 && (
        <details className="text-xs text-muted">
          <summary className="cursor-pointer select-none hover:text-fg">
            {data.untracked.length} more {data.name} card{data.untracked.length === 1 ? "" : "s"} in sets that can&apos;t be tracked yet
          </summary>
          <p className="mt-2 max-w-2xl">
            These sets are in the card catalog but aren&apos;t paired with a set in the price data, so they can&apos;t be marked as owned or counted
            toward completion. Some are digital-only. Sets that are paired are on the{" "}
            <Link href="/collection" className="link">
              Sets page
            </Link>
            .
          </p>
          <ul className="mt-2 max-h-60 divide-y divide-line overflow-auto rounded-lg border border-line">
            {data.untracked.map((c) => (
              <li key={c.key} className="flex justify-between gap-3 px-3 py-1.5">
                <span className="truncate">
                  {c.name} <span className="text-subtle">· {c.setName}</span>
                </span>
                <span className="num shrink-0 text-subtle">{c.number}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
