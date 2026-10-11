"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { SetDetailPayload, SetItemDTO, SetItemSort } from "@/lib/clientTypes";
import { formatDate, timeAgo } from "@/lib/labels";
import { cardKey } from "@/lib/collection/numbers";
import type { SetSummary } from "@/lib/collection/progress";
import type { OwnedResult } from "@/lib/collection/types";
import {
  MAX_SET_ROWS,
  filterItems,
  formatPriceRange,
  isOversized,
  isUpcoming,
  rarityOptions,
  sortItems,
} from "@/lib/sets/setsView";
import { useApi } from "@/lib/useApi";
import ApiStatus from "./ApiStatus";
import SaveAlert from "./SaveAlert";
import SetCompletion from "./SetCompletion";
import SetItemRow from "./SetItemRow";
import EmptyState from "./ui/EmptyState";
import Icon from "./ui/Icon";
import Segmented from "./ui/Segmented";

const PAGE_SIZE = 60;

const SORT_LABELS: Record<SetItemSort, string> = {
  price_desc: "Price: High to Low",
  price_asc: "Price: Low to High",
  number: "Card number",
  name: "A–Z",
};

type View = "cards" | "products";

function BackLink() {
  return (
    <Link href="/browse" className="mb-4 inline-flex items-center gap-1 text-xs text-subtle hover:text-fg">
      <Icon name="back" className="h-3.5 w-3.5" />
      All sets
    </Link>
  );
}

export default function SetDetail({ slug }: { slug: string }) {
  const { data, error, loading, reload, replace } = useApi<SetDetailPayload>(`/api/sets/${encodeURIComponent(slug)}`);
  // Until a tab is chosen: the set's products if it has any, otherwise its cards.
  const [chosenView, setView] = useState<View | null>(null);
  const [query, setQuery] = useState("");
  const [rarity, setRarity] = useState("");
  const [sort, setSort] = useState<SetItemSort>("price_asc");
  const [limit, setLimit] = useState(PAGE_SIZE);
  const [refreshing, setRefreshing] = useState(false);
  const [missingOnly, setMissingOnly] = useState(false);
  // Copies-owned changes made on this page, by card key: applied at once while the save is in flight.
  const [edits, setEdits] = useState<Record<string, number>>({});
  // The summary the server sent back after the latest change (newer than the one the page loaded with).
  const [summaryOverride, setSummaryOverride] = useState<SetSummary | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const savedItems = useMemo(() => data?.items ?? [], [data]);
  const items = useMemo(
    () =>
      savedItems.map((i) => {
        if (i.group !== "card") return i;
        const q = edits[cardKey(i.number) ?? ""];
        return q === undefined ? i : { ...i, owned: q };
      }),
    [savedItems, edits],
  );
  const summary = summaryOverride ?? data?.collection ?? null;
  const cardCount = items.filter((i) => i.group === "card").length;
  const productCount = items.length - cardCount;
  const view: View = chosenView ?? (productCount > 0 || cardCount === 0 ? "products" : "cards");
  const rarities = useMemo(() => rarityOptions(items.filter((i) => i.group === "card")), [items]);
  const matching = useMemo(() => {
    let list = filterItems(items, { query, rarity, view });
    // Every printing of a card you own is hidden together: ownership is per card number.
    if (missingOnly && view === "cards") list = list.filter((i) => i.owned === 0);
    return sortItems(list, sort);
  }, [items, query, rarity, view, sort, missingOnly]);

  // Changing any filter starts the list over from the first page.
  function changeFilter(apply: () => void) {
    apply();
    setLimit(PAGE_SIZE);
  }

  /** Saves a new total of copies for one card; the page updates at once and rolls back if the save fails. */
  async function saveOwned(item: SetItemDTO, quantity: number) {
    if (!data || !item.number) return;
    const key = cardKey(item.number) ?? "";
    const previous = items.find((i) => i.group === "card" && cardKey(i.number) === key)?.owned ?? 0;
    setEdits((e) => ({ ...e, [key]: quantity }));
    setSaveError(null);
    try {
      const res = await fetch("/api/collection/items", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ setId: data.set.id, number: item.number, quantity }),
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok) {
        setSummaryOverride((json as OwnedResult).summary);
        return;
      }
      setSaveError(json.error ?? "Couldn't save that change.");
    } catch (err) {
      setSaveError((err as Error).message);
    }
    setEdits((e) => ({ ...e, [key]: previous }));
  }

  async function refresh() {
    setRefreshing(true);
    try {
      const res = await fetch(`/api/sets/${encodeURIComponent(slug)}?refresh=1`);
      if (res.ok) {
        replace((await res.json()) as SetDetailPayload);
        setSummaryOverride(null);
      }
    } finally {
      setRefreshing(false);
    }
  }

  if (!data) {
    return (
      <>
        <BackLink />
        {loading ? (
          <p className="text-sm text-muted">
            Loading set… the first time a set is opened it&apos;s fetched from tcgapi.dev, which can take a few seconds.
          </p>
        ) : (
          <p className="text-sm text-warn">{error ?? "Couldn't load this set."}</p>
        )}
      </>
    );
  }

  const { set } = data;
  const art = set.iconUrl ?? set.imageUrl;

  return (
    <div className="space-y-5">
      <div>
        <BackLink />
        <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
          {art && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={art} alt="" className="h-20 w-32 shrink-0 rounded-xl border border-line object-cover" />
          )}
          <div className="min-w-0 flex-1 basis-60">
            <h1 className="text-[1.375rem] font-semibold leading-tight tracking-tight">{set.name}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {isUpcoming(set) && <span className="chip chip-accent">Upcoming</span>}
              <span className="chip">{set.releaseDate ? `Released ${formatDate(set.releaseDate)}` : "Release date unknown"}</span>
              <span className="chip num">{cardCount} cards</span>
              <span className="chip num">{productCount} products</span>
              {set.priceRange && <span className="chip num">{formatPriceRange(set.priceRange)}</span>}
            </div>
          </div>
          <div className="text-right">
            <button
              onClick={refresh}
              disabled={refreshing}
              title="Re-fetch prices for this set (spends API requests; limited to once an hour)"
              className="btn"
            >
              <Icon name="refresh" /> {refreshing ? "Refreshing…" : "Refresh prices"}
            </button>
            <p className="mt-1 text-xs text-subtle">
              {set.itemsFetchedAt ? `prices updated ${timeAgo(set.itemsFetchedAt)}` : "prices not loaded yet"}
            </p>
          </div>
        </div>
      </div>

      <ApiStatus error={data.error ?? error} budget={data.budget} />

      {isOversized(set) && (
        <p className="rounded-lg border border-warn/30 bg-warn-soft px-3 py-2 text-xs text-warn">
          This set has {set.cardCount.toLocaleString()} items — more than the free tier can load — so only the first{" "}
          {MAX_SET_ROWS.toLocaleString()} are shown and there&apos;s no price range or completion figure.
        </p>
      )}

      {summary && !isOversized(set) && (
        <section className="card space-y-3 p-4" aria-label="Your collection">
          <SetCompletion summary={summary} />
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3 text-xs">
            <span className="text-subtle">
              {summary.source === "official" ? "Counted against the set's full card list." : "Counted against the cards tcgapi.dev lists."}
            </span>
            <Link href={`/collection/${set.slug}`} className="link inline-flex items-center gap-1">
              Open in Collection <Icon name="arrow" className="h-3.5 w-3.5" />
            </Link>
          </div>
          {saveError && <p className="text-xs text-bad">{saveError}</p>}
        </section>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Segmented
          label="Show"
          value={view}
          onChange={(v) => changeFilter(() => setView(v))}
          items={[
            { key: "cards", label: "Cards", count: cardCount },
            { key: "products", label: "Products", count: productCount },
          ]}
        />

        <div className="flex flex-wrap items-center gap-2">
          {view === "cards" && summary && (
            <label className="flex cursor-pointer items-center gap-1.5 text-sm text-muted">
              <input
                type="checkbox"
                checked={missingOnly}
                onChange={(e) => changeFilter(() => setMissingOnly(e.target.checked))}
                className="accent-[var(--accent)]"
              />
              Missing only
            </label>
          )}
          <div className="relative">
            <Icon name="search" className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
            <input
              value={query}
              onChange={(e) => changeFilter(() => setQuery(e.target.value))}
              placeholder="Name or number"
              aria-label="Search this set"
              className="input w-44 pl-8"
            />
          </div>
          {view === "cards" && rarities.length > 0 && (
            <select
              value={rarity}
              onChange={(e) => changeFilter(() => setRarity(e.target.value))}
              aria-label="Filter by rarity"
              className="input"
            >
              <option value="">All rarities</option>
              {rarities.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          )}
          <select
            value={sort}
            onChange={(e) => changeFilter(() => setSort(e.target.value as SetItemSort))}
            aria-label="Sort"
            className="input"
          >
            {(Object.keys(SORT_LABELS) as SetItemSort[]).map((s) => (
              <option key={s} value={s}>
                {SORT_LABELS[s]}
              </option>
            ))}
          </select>
        </div>
      </div>

      {items.length > 0 && (
        <SaveAlert
          setSlug={set.slug}
          setName={set.name}
          kind={view === "cards" ? "CARD" : "SEALED"}
          rarity={rarity}
          query={query}
          items={items}
        />
      )}

      {items.length === 0 ? (
        <EmptyState title="No prices saved for this set yet.">
          {data.error ? "See the note above." : "They're fetched the first time a set is opened."}
        </EmptyState>
      ) : matching.length === 0 ? (
        <EmptyState
          title={missingOnly && view === "cards" ? "Nothing missing that matches those filters — nice." : "Nothing matches those filters."}
        />
      ) : (
        <div className="space-y-2">
          {matching.slice(0, limit).map((item) => (
            <SetItemRow key={item.id} item={item} onChanged={reload} onOwnedChange={(it, q) => void saveOwned(it, q)} />
          ))}
          {matching.length > limit && (
            <button onClick={() => setLimit((l) => l + PAGE_SIZE)} className="btn w-full border-dashed">
              Show {Math.min(PAGE_SIZE, matching.length - limit)} more ({matching.length - limit} remaining)
            </button>
          )}
        </div>
      )}
    </div>
  );
}
