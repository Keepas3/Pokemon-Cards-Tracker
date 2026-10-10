"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { formatDate } from "@/lib/labels";
import type { CollectionCard, SetSummary } from "@/lib/collection/progress";
import type { CollectionSetPayload, OwnedResult } from "@/lib/collection/types";
import { useApi } from "@/lib/useApi";
import { CardGrid, CardList } from "./CardGrid";
import PullLogger from "./PullLogger";
import SetCompletion from "./SetCompletion";
import SetItemRow from "./SetItemRow";
import EmptyState from "./ui/EmptyState";
import Icon from "./ui/Icon";
import LogoImage from "./ui/LogoImage";
import Segmented from "./ui/Segmented";

const PAGE_SIZE = 240;

type View = "cards" | "products";
type Layout = "grid" | "list";
type Order = "print" | "price_desc" | "price_asc";

const ORDER_LABELS: Record<Order, string> = {
  print: "Print order",
  price_desc: "Price: High to Low",
  price_asc: "Price: Low to High",
};

function BackLink() {
  return (
    <Link href="/collection" className="mb-4 inline-flex items-center gap-1 text-xs text-subtle hover:text-fg">
      <Icon name="back" className="h-3.5 w-3.5" />
      All sets
    </Link>
  );
}

export default function CollectionSet({ slug }: { slug: string }) {
  const { data, error, loading, reload } = useApi<CollectionSetPayload>(`/api/collection/sets/${encodeURIComponent(slug)}`);
  const [view, setView] = useState<View>("cards");
  const [layout, setLayout] = useState<Layout>("grid");
  const [query, setQuery] = useState("");
  const [rarity, setRarity] = useState("");
  const [order, setOrder] = useState<Order>("print");
  const [missingOnly, setMissingOnly] = useState(false);
  const [limit, setLimit] = useState(PAGE_SIZE);
  const [edits, setEdits] = useState<Record<string, number>>({});
  const [summaryOverride, setSummaryOverride] = useState<SetSummary | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  // What you own, with any change made on this page applied at once.
  const cards = useMemo<CollectionCard[]>(
    () => (data?.cards ?? []).map((c) => (edits[c.key] === undefined ? c : { ...c, owned: edits[c.key] })),
    [data, edits],
  );
  const summary = summaryOverride ?? data?.summary ?? null;

  const rarities = useMemo(() => {
    const counts = new Map<string, number>();
    for (const c of cards) if (c.rarity) counts.set(c.rarity, (counts.get(c.rarity) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([r]) => r);
  }, [cards]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = cards.filter((c) => {
      if (missingOnly && c.owned > 0) return false;
      if (rarity && c.rarity !== rarity) return false;
      if (q && !c.name.toLowerCase().includes(q) && !c.number.toLowerCase().includes(q)) return false;
      return true;
    });
    if (order !== "print") {
      const dir = order === "price_desc" ? -1 : 1;
      list = [...list].sort((a, b) => {
        if (a.priceCents == null && b.priceCents == null) return 0;
        if (a.priceCents == null) return 1;
        if (b.priceCents == null) return -1;
        return (a.priceCents - b.priceCents) * dir;
      });
    }
    return list;
  }, [cards, query, rarity, missingOnly, order]);

  function changeFilter(apply: () => void) {
    apply();
    setLimit(PAGE_SIZE);
  }

  /** Saves a new total of copies; the page updates at once and rolls back if the save fails. */
  async function saveOwned(card: CollectionCard, quantity: number): Promise<boolean> {
    if (!data) return false;
    const previous = cards.find((c) => c.key === card.key)?.owned ?? 0;
    setEdits((e) => ({ ...e, [card.key]: quantity }));
    setSaveError(null);
    try {
      const res = await fetch("/api/collection/items", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ setId: data.set.id, number: card.number, quantity }),
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok) {
        setSummaryOverride((json as OwnedResult).summary);
        return true;
      }
      setSaveError(json.error ?? "Couldn't save that change.");
    } catch (err) {
      setSaveError((err as Error).message);
    }
    setEdits((e) => ({ ...e, [card.key]: previous }));
    return false;
  }

  if (!data) {
    return (
      <>
        <BackLink />
        {loading ? (
          <p className="text-sm text-muted">Loading the set&apos;s card list…</p>
        ) : (
          <p className="text-sm text-warn">{error ?? "Couldn't load this set."}</p>
        )}
      </>
    );
  }

  const { set, products } = data;

  return (
    <div className="space-y-5">
      <div>
        <BackLink />
        <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
          {set.logoUrl && (
            <div className="flex h-20 w-40 shrink-0 items-center justify-center rounded-xl border border-line bg-surface-2 p-2">
              <LogoImage src={set.logoUrl} className="logo-img h-full w-full object-contain" fallback={null} />
            </div>
          )}
          <div className="min-w-0 flex-1 basis-60">
            <h1 className="text-[1.375rem] font-semibold leading-tight tracking-tight">{set.name}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {set.seriesName && <span className="chip">{set.seriesName}</span>}
              <span className="chip">{set.releaseDate ? `Released ${formatDate(set.releaseDate)}` : "Release date unknown"}</span>
              {!set.official && cards.length > 0 && <span className="chip chip-warn">Card list from tcgapi.dev</span>}
            </div>
          </div>
          <Link href={`/browse/sets/${set.slug}`} className="btn">
            Prices in Browse <Icon name="arrow" />
          </Link>
        </div>
      </div>

      {data.error && (
        <p className="rounded-lg border border-warn/30 bg-warn-soft px-3 py-2 text-xs text-warn">
          {data.error}
          {!set.official && " Showing the cards tcgapi.dev lists; the full official list isn't available for this set."}
        </p>
      )}

      {summary && summary.totalCards > 0 ? (
        <section className="card space-y-4 p-4" aria-label="Your collection">
          <SetCompletion summary={summary} cards={cards} />
          <div className="border-t border-line pt-4">
            <PullLogger cards={cards} onSetOwned={saveOwned} />
          </div>
          {saveError && <p className="text-xs text-bad">{saveError}</p>}
        </section>
      ) : (
        <EmptyState title="No card list for this set.">
          {set.official
            ? "Its cards will appear here once the catalog lists them."
            : products.length > 0
              ? "This looks like a products-only release, or its cards aren't listed yet. Its products are under the Products tab."
              : "Open the set in Browse to load its prices from tcgapi.dev, then come back."}
        </EmptyState>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Segmented
          label="Show"
          value={view}
          onChange={(v) => changeFilter(() => setView(v))}
          items={[
            { key: "cards", label: "Cards", count: cards.length },
            { key: "products", label: "Products", count: products.length },
          ]}
        />

        {view === "cards" && (
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex cursor-pointer items-center gap-1.5 text-sm text-muted">
              <input
                type="checkbox"
                checked={missingOnly}
                onChange={(e) => changeFilter(() => setMissingOnly(e.target.checked))}
                className="accent-[var(--accent)]"
              />
              Missing only
            </label>
            <div className="relative">
              <Icon name="search" className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
              <input
                value={query}
                onChange={(e) => changeFilter(() => setQuery(e.target.value))}
                placeholder="Name or number"
                aria-label="Search this set"
                className="input w-40 pl-8"
              />
            </div>
            {rarities.length > 0 && (
              <select value={rarity} onChange={(e) => changeFilter(() => setRarity(e.target.value))} aria-label="Filter by rarity" className="input">
                <option value="">All rarities</option>
                {rarities.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            )}
            <select value={order} onChange={(e) => changeFilter(() => setOrder(e.target.value as Order))} aria-label="Order" className="input">
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
        )}
      </div>

      {view === "cards" ? (
        cards.length === 0 ? null : shown.length === 0 ? (
          <EmptyState title={missingOnly ? "Nothing missing that matches those filters — nice." : "Nothing matches those filters."} />
        ) : (
          <>
            {layout === "grid" ? (
              <CardGrid cards={shown.slice(0, limit)} onChange={(c, q) => void saveOwned(c, q)} />
            ) : (
              <CardList cards={shown.slice(0, limit)} onChange={(c, q) => void saveOwned(c, q)} />
            )}
            {shown.length > limit && (
              <button onClick={() => setLimit((l) => l + PAGE_SIZE)} className="btn w-full border-dashed">
                Show {Math.min(PAGE_SIZE, shown.length - limit)} more ({shown.length - limit} remaining)
              </button>
            )}
          </>
        )
      ) : products.length === 0 ? (
        <EmptyState title="No sealed products or other items listed for this set.">
          They come from tcgapi.dev when the set&apos;s prices are loaded in Browse.
        </EmptyState>
      ) : (
        <div className="space-y-2">
          <p className="text-xs text-subtle">
            Sealed products, collection boxes and code cards aren&apos;t cards, so they don&apos;t count toward completion.
          </p>
          {products.map((p) => (
            <SetItemRow key={p.id} item={p} onChanged={reload} />
          ))}
        </div>
      )}
    </div>
  );
}
