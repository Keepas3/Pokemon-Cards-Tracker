"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { SetDTO, SetSort, SetsPayload } from "@/lib/clientTypes";
import { formatDate, timeAgo } from "@/lib/labels";
import {
  PRICE_LOAD_BATCH,
  estimateRequests,
  filterSets,
  formatPriceRange,
  isOversized,
  isUpcoming,
  setsMissingPrices,
  sortSets,
} from "@/lib/sets/setsView";
import { storedImageSrc } from "@/lib/images/rules";
import { useApi } from "@/lib/useApi";
import ApiStatus from "./ApiStatus";
import EmptyState from "./ui/EmptyState";
import Icon from "./ui/Icon";

const SORT_LABELS: Record<SetSort, string> = {
  newest: "Newest",
  oldest: "Oldest",
  name: "A–Z",
  cards: "Most cards",
};

function SetTile({ set }: { set: SetDTO }) {
  const upcoming = isUpcoming(set);
  const art = set.iconUrl ?? set.imageUrl;
  return (
    <Link
      href={`/browse/sets/${set.slug}`}
      className="group card flex flex-col overflow-hidden transition hover:border-line-strong hover:shadow-md"
    >
      <div className="relative aspect-[3/2] w-full overflow-hidden bg-surface-2">
        {art ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={storedImageSrc(art)}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-subtle">
            <Icon name="browse" className="h-10 w-10" />
          </div>
        )}
        {upcoming && <span className="chip chip-accent absolute left-3 top-3 shadow-sm">Upcoming</span>}
      </div>

      <div className="flex flex-1 flex-col gap-1 p-4">
        <h3 className="line-clamp-2 text-base font-semibold leading-snug tracking-tight" title={set.name}>
          {set.name}
        </h3>
        <p className="text-xs text-subtle">
          {set.releaseDate ? formatDate(set.releaseDate) : "Release date unknown"} · {set.cardCount} items
        </p>

        <div className="mt-auto pt-3">
          {isOversized(set) ? (
            <p className="text-xs text-subtle">
              No price range — {set.cardCount.toLocaleString()} items is more than the free tier can load
            </p>
          ) : set.priceRange ? (
            <>
              <p className="num text-xl font-semibold tracking-tight">{formatPriceRange(set.priceRange)}</p>
              <p className="text-xs text-subtle">
                Price Range
                {set.itemsFetchedAt ? ` · updated ${timeAgo(set.itemsFetchedAt)}` : ""}
              </p>
            </>
          ) : set.itemsFetchedAt ? (
            // Fetched, but nothing in it has a market price (tiny promo sets, brand-new releases).
            <p className="text-xs text-subtle">No prices listed yet · checked {timeAgo(set.itemsFetchedAt)}</p>
          ) : (
            <p className="text-xs text-subtle">Prices not loaded yet — filling in automatically</p>
          )}
        </div>
      </div>
    </Link>
  );
}

export default function SetsBrowser() {
  const { data, error, loading, reload, replace } = useApi<SetsPayload>("/api/sets");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SetSort>("newest");
  const [refreshing, setRefreshing] = useState(false);
  const [loadingPrices, setLoadingPrices] = useState(false);
  const [priceMsg, setPriceMsg] = useState<string | null>(null);

  const visible = useMemo(() => sortSets(filterSets(data?.sets ?? [], query), sort), [data, query, sort]);
  const missing = useMemo(() => setsMissingPrices(visible), [visible]);
  const nextBatch = missing.slice(0, PRICE_LOAD_BATCH);
  // Oversized sets can never show a full range, so they're counted separately
  // rather than as "still to load".
  const rangeable = useMemo(() => visible.filter((s) => !isOversized(s)), [visible]);
  const withRange = rangeable.filter((s) => s.priceRange).length;
  const oversizedCount = visible.length - rangeable.length;

  async function refresh() {
    setRefreshing(true);
    try {
      const res = await fetch("/api/sets?refresh=1");
      replace((await res.json()) as SetsPayload);
    } finally {
      setRefreshing(false);
    }
  }

  async function loadPrices() {
    setLoadingPrices(true);
    setPriceMsg(null);
    try {
      const res = await fetch("/api/sets/prices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slugs: visible.map((s) => s.slug), limit: PRICE_LOAD_BATCH }),
      });
      const result = await res.json();
      if (!res.ok) {
        setPriceMsg(result.error ?? "couldn't load prices");
      } else {
        setPriceMsg(
          `Loaded prices for ${result.loaded} set${result.loaded === 1 ? "" : "s"}.` +
            (result.stoppedReason ? ` Stopped early: ${result.stoppedReason}` : ""),
        );
      }
      reload();
    } finally {
      setLoadingPrices(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-48 flex-1 sm:max-w-xs">
          <Icon name="search" className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search sets, e.g. 30th"
            aria-label="Search sets"
            className="input w-full pl-8"
          />
        </div>
        <select value={sort} onChange={(e) => setSort(e.target.value as SetSort)} aria-label="Sort sets" className="input">
          {(Object.keys(SORT_LABELS) as SetSort[]).map((s) => (
            <option key={s} value={s}>
              {SORT_LABELS[s]}
            </option>
          ))}
        </select>
        <button
          onClick={refresh}
          disabled={refreshing}
          title="Re-fetch the set list (spends API requests; limited to once an hour)"
          className="btn btn-ghost ml-auto"
        >
          <Icon name="refresh" /> {refreshing ? "Refreshing…" : "Refresh list"}
        </button>
      </div>

      <ApiStatus error={data?.error ?? error} budget={data?.budget ?? null} />

      {visible.length > 0 && (
        <div className="card px-4 py-3 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-muted">
              Price ranges ready for <span className="num font-semibold text-fg">{withRange}</span> of{" "}
              <span className="num">{rangeable.length}</span> set{rangeable.length === 1 ? "" : "s"}
              {oversizedCount > 0 && ` · ${oversizedCount} too large to show one`}
            </p>
            {nextBatch.length > 0 ? (
              <button onClick={loadPrices} disabled={loadingPrices} className="btn btn-primary">
                {loadingPrices
                  ? "Loading prices…"
                  : `Load ${nextBatch.length} more now (~${estimateRequests(nextBatch)} requests)`}
              </button>
            ) : (
              <span className="chip chip-good">
                <Icon name="check" className="h-3 w-3" /> All shown sets have prices
              </span>
            )}
          </div>
          {priceMsg && <p className="mt-2 text-xs text-muted">{priceMsg}</p>}
          <details className="mt-2 text-xs text-subtle">
            <summary>How prices get filled in</summary>
            <p className="mt-1.5 max-w-2xl">
              The rest fill in automatically in the background — about one set every 15 minutes, using only spare daily
              requests. Each set is saved once it loads, and re-fetched after a week or whenever you open it with prices
              over 12 hours old.
            </p>
          </details>
        </div>
      )}

      {loading && !data ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : visible.length === 0 ? (
        <EmptyState title={data && data.sets.length > 0 ? "No sets match that search." : "No sets loaded yet."}>
          {data && data.sets.length > 0 ? null : (
            <>Add a TCGAPI_DEV_API_KEY (see Settings), then click Refresh list.</>
          )}
        </EmptyState>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {visible.map((s) => (
              <SetTile key={s.id} set={s} />
            ))}
          </div>
          <p className="text-xs text-subtle">
            {visible.length} set{visible.length === 1 ? "" : "s"}
            {data?.fetchedAt ? ` · list updated ${timeAgo(data.fetchedAt)}` : ""}
          </p>
        </>
      )}
    </div>
  );
}
