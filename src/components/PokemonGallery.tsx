"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { GENERATIONS } from "@/lib/pokedex/species";
import type { PokemonGalleryPayload, PokemonTileDTO } from "@/lib/pokedex/types";
import { useApi } from "@/lib/useApi";
import CollectionTabs from "./CollectionTabs";
import EmptyState from "./ui/EmptyState";
import Icon from "./ui/Icon";
import PageHeader from "./ui/PageHeader";
import ProgressBar from "./ui/ProgressBar";
import Segmented from "./ui/Segmented";
import Stat from "./ui/Stat";

const PAGE_SIZE = 120;
const pad = (n: number) => String(n).padStart(3, "0");

function Tile({ p, onToggle }: { p: PokemonTileDTO; onToggle: (p: PokemonTileDTO) => void }) {
  const complete = p.percent === 100;
  const hasProgress = p.totalCards != null;
  return (
    <div className="relative">
    <Link
      href={`/collection/pokemon/${p.dexId}`}
      className={`group card flex gap-3 overflow-hidden p-3 transition hover:border-line-strong hover:shadow-md ${complete ? "border-good/50" : ""}`}
    >
      {(p.followed || p.haveCards > 0 || hasProgress) && (
        <div className="h-16 w-12 shrink-0 overflow-hidden rounded bg-surface-2">
          {p.imageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={p.imageUrl} alt="" loading="lazy" className="h-full w-full object-cover" />
          )}
        </div>
      )}
      <div className="min-w-0 flex-1 space-y-1 pr-5">
        <p className="num text-xs text-subtle">#{pad(p.dexId)}</p>
        <p className="truncate font-medium leading-tight" title={p.name}>
          {p.name}
        </p>
        {hasProgress ? (
          <div className="space-y-1 pt-0.5">
            <ProgressBar value={p.ownedCards ?? 0} max={p.totalCards!} label={`${p.name} completion`} complete={complete} />
            <p className="num text-xs text-muted">
              {p.ownedCards ?? 0} / {p.totalCards}
              {p.percent != null && ` · ${p.percent}%`}
            </p>
          </div>
        ) : null}
        {!hasProgress && p.haveCards > 0 && (
          <p className="num text-xs text-good">
            You have {p.haveCards} card{p.haveCards === 1 ? "" : "s"}
          </p>
        )}
      </div>
    </Link>
      <button
        onClick={() => onToggle(p)}
        aria-pressed={p.followed}
        aria-label={p.followed ? `Unfollow ${p.name}` : `Follow ${p.name}`}
        title={p.followed ? "Following — click to unfollow" : "Click to follow"}
        className={`absolute right-2 top-2 rounded p-1 transition ${p.followed ? "text-accent-text" : "text-subtle opacity-60 hover:text-fg hover:opacity-100"}`}
      >
        <Icon name="bookmark" className={`h-4 w-4 ${p.followed ? "fill-current" : ""}`} />
      </button>
    </div>
  );
}

type Filter = "following" | "bookmarked" | "all";

export default function PokemonGallery() {
  const { data, error, loading } = useApi<PokemonGalleryPayload>("/api/collection/pokemon");
  const [filter, setFilter] = useState<Filter | null>(null);
  const [query, setQuery] = useState("");
  const [gen, setGen] = useState("");
  const [limit, setLimit] = useState(PAGE_SIZE);
  const [follows, setFollows] = useState<Record<number, boolean>>({});

  async function toggle(p: PokemonTileDTO) {
    const next = !p.followed;
    setFollows((f) => ({ ...f, [p.dexId]: next }));
    const res = await fetch(`/api/collection/pokemon/${p.dexId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ followed: next }),
    }).catch(() => null);
    if (!res?.ok) setFollows((f) => ({ ...f, [p.dexId]: !next }));
  }

  const followingCount = data?.totals.collecting ?? 0;
  // Cards you own in each generation (the count each tile shows, or the name-matched count until its card list is loaded).
  const ownedByGen = useMemo(() => {
    const perGen = new Map<number, number>();
    let total = 0;
    for (const p of data?.species ?? []) {
      const n = p.ownedCards ?? p.haveCards;
      if (!n) continue;
      total += n;
      const g = GENERATIONS.find((x) => p.dexId >= x.first && p.dexId <= x.last);
      if (g) perGen.set(g.gen, (perGen.get(g.gen) ?? 0) + n);
    }
    return { perGen, total };
  }, [data]);
  const bookmarkedCount = (data?.species ?? []).filter((p) => follows[p.dexId] ?? p.followed).length;
  // Until you choose, show the ones you follow if there are any, otherwise everything.
  const active: Filter = filter ?? (followingCount > 0 ? "following" : "all");

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase().replace(/^#/, "");
    const g = GENERATIONS.find((x) => String(x.gen) === gen);
    return (data?.species ?? []).map((p) => ({ ...p, followed: follows[p.dexId] ?? p.followed })).filter((p) => {
      if (active === "following" && !p.followed && p.haveCards === 0) return false;
      if (active === "bookmarked" && !p.followed) return false;
      if (g && (p.dexId < g.first || p.dexId > g.last)) return false;
      if (q && !p.name.toLowerCase().includes(q) && String(p.dexId) !== q.replace(/^0+/, "")) return false;
      return true;
    });
  }, [data, active, query, gen, follows]);

  const header = (
    <PageHeader
      title="Collection"
      description="Collect every card of the Pokémon you love, across all sets. Open one to see each printing and tick off what you own."
      actions={<CollectionTabs active="pokemon" />}
    />
  );

  if (loading && !data) {
    return (
      <>
        {header}
        <p className="text-sm text-muted">Loading…</p>
      </>
    );
  }
  if (!data) {
    return (
      <>
        {header}
        <p className="text-sm text-warn">{error ?? "Couldn't load the Pokémon list."}</p>
      </>
    );
  }

  const reset = (apply: () => void) => {
    apply();
    setLimit(PAGE_SIZE);
  };

  return (
    <>
      {header}
      <div className="space-y-6">
        <div className="grid grid-cols-3 gap-3">
          <Stat label="Collecting" value={data.totals.collecting} />
          <Stat label="Complete" value={data.totals.complete} tone={data.totals.complete > 0 ? "good" : "default"} />
          <Stat label="Cards owned" value={data.totals.cardsOwned} />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <Segmented
            label="Which Pokémon"
            value={active}
            onChange={(f) => reset(() => setFilter(f))}
            items={[
              { key: "following", label: "My Pokémon", count: followingCount },
              { key: "all", label: "All Pokémon", count: data.species.length },
              { key: "bookmarked", label: "Bookmarked", count: bookmarkedCount },
            ]}
          />
          <div className="flex flex-wrap items-center gap-2">
            <select value={gen} onChange={(e) => reset(() => setGen(e.target.value))} aria-label="Generation" className="input">
              <option value="">All generations · {ownedByGen.total}</option>
              {GENERATIONS.map((g) => (
                <option key={g.gen} value={g.gen}>
                  Gen {g.gen} ({g.first}–{g.last}) · {ownedByGen.perGen.get(g.gen) ?? 0}
                </option>
              ))}
            </select>
            <div className="relative">
              <Icon name="search" className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
              <input
                value={query}
                onChange={(e) => reset(() => setQuery(e.target.value))}
                placeholder="Name or number, e.g. char or 25"
                aria-label="Search Pokémon"
                className="input w-56 pl-8"
              />
            </div>
          </div>
        </div>

        {shown.length === 0 ? (
          active === "following" && !query && !gen ? (
            <EmptyState title="You don't have any Pokémon yet.">
              Choose <span className="font-medium text-fg">All Pokémon</span>, open one, and tick off the cards you own — or press{" "}
              <span className="font-medium text-fg">Follow</span> to keep it here with its progress.
            </EmptyState>
          ) : active === "bookmarked" && !query && !gen ? (
            <EmptyState title="Nothing bookmarked yet.">Click the bookmark on a Pokémon&apos;s tile to keep it here.</EmptyState>
          ) : (
            <EmptyState title="No Pokémon match that." />
          )
        ) : (
          <>
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {shown.slice(0, limit).map((p) => (
                <li key={p.dexId} className="min-w-0">
                  <Tile p={p} onToggle={toggle} />
                </li>
              ))}
            </ul>
            {shown.length > limit && (
              <button onClick={() => setLimit((l) => l + PAGE_SIZE)} className="btn w-full border-dashed">
                Show {Math.min(PAGE_SIZE, shown.length - limit)} more ({shown.length - limit} remaining)
              </button>
            )}
          </>
        )}

        <p className="text-xs text-subtle">Prices are up to 12 hours old. A card counts in any printing, and in any set we can track.</p>
      </div>
    </>
  );
}
