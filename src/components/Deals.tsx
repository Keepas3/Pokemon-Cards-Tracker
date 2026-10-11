"use client";

import { useState } from "react";
import Link from "next/link";
import type { DealDTO, DealScope, DealsPayload } from "@/lib/deals/types";
import { formatPrice, timeAgo } from "@/lib/labels";
import { safeHref } from "@/lib/security/urls";
import { useApi } from "@/lib/useApi";
import CollectionTabs from "./CollectionTabs";
import EmptyState from "./ui/EmptyState";
import Icon from "./ui/Icon";
import PageHeader from "./ui/PageHeader";
import Segmented from "./ui/Segmented";

const CARD_DISCOUNTS = [20, 25, 35, 50];
const PRODUCT_DISCOUNTS = [10, 15, 25, 35, 50];
type Kind = "cards" | "products";
type Order = "best" | "price_asc" | "price_desc";
const ORDER_LABELS: Record<Order, string> = { best: "Best deal first", price_asc: "Price: Low to High", price_desc: "Price: High to Low" };

/** One deal: the card, what it costs now versus market, and a button for when you've bought it. */
export function DealRow({ deal, onGot }: { deal: DealDTO; onGot?: (deal: DealDTO) => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-3 sm:flex-nowrap sm:px-4">
      <div className="h-16 w-12 shrink-0 overflow-hidden rounded bg-surface-2">
        {deal.imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={deal.imageUrl} alt="" loading="lazy" className="h-full w-full object-cover" />
        )}
      </div>

      <div className="min-w-0 flex-1 basis-32 space-y-0.5">
        <a href={safeHref(deal.tcgplayerUrl)} target="_blank" rel="noreferrer" className="block truncate font-medium hover:underline" title={deal.name}>
          {deal.name}
        </a>
        <p className="truncate text-xs text-subtle">
          {deal.setSlug ? (
            <Link href={`/collection/${deal.setSlug}`} className="hover:text-fg hover:underline">
              {deal.setName}
            </Link>
          ) : (
            deal.setName
          )}
          {deal.number && ` · ${deal.number}`}
          {deal.rarity && ` · ${deal.rarity}`}
          {deal.ownedInSet > 0 && (deal.kind === "product" ? " · you collect this set" : ` · you own ${deal.ownedInSet} here`)}
        </p>
        {deal.suspicious && (
          <p className="text-xs text-warn">Unusually low — often a damaged copy or a typo. Check the listing.</p>
        )}
      </div>

      <div className="flex w-full items-center justify-between gap-3 sm:contents">
      <div className="shrink-0 text-left sm:text-right">
        <p className="num text-base font-semibold text-good">{formatPrice(deal.lowCents)}</p>
        <p className="num text-xs text-subtle">
          market {formatPrice(deal.marketCents)} · <span className="text-good">{Math.round(deal.savingsPct * 100)}% off</span>
        </p>
        <p className="num text-xs text-muted">save {formatPrice(deal.savingsCents)}</p>
      </div>

      <div className="flex shrink-0 items-center gap-3 sm:flex-col sm:items-end sm:gap-1.5">
        <a href={safeHref(deal.tcgplayerUrl)} target="_blank" rel="noreferrer" className="btn btn-sm">
          TCGplayer <Icon name="external" className="h-3.5 w-3.5" />
        </a>
        {onGot && (
          <button
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              await onGot(deal);
              setBusy(false);
            }}
            className="text-xs text-subtle hover:text-fg disabled:opacity-50"
            title="Mark this card as owned and take it off this list"
          >
            I got it
          </button>
        )}
      </div>
      </div>
    </li>
  );
}

/** `initialKind`: "See all" on Today opens the packs, tins & boxes list. */
export default function Deals({ initialKind = "cards" }: { initialKind?: Kind }) {
  const [scope, setScope] = useState<DealScope>("mine");
  const [kind, setKind] = useState<Kind>(initialKind);
  const [minPct, setMinPct] = useState(initialKind === "products" ? 10 : 25);
  // Packs, tins & boxes start cheapest first; cards start with the biggest saving.
  const [order, setOrder] = useState<Order>(initialKind === "products" ? "price_asc" : "best");
  const [got, setGot] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const { data, error: loadError, loading } = useApi<DealsPayload>(`/api/deals?kind=${kind}&scope=${scope}&minPct=${minPct}&limit=100`);

  async function markOwned(deal: DealDTO) {
    setError(null);
    const res = await fetch("/api/collection/items", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ setId: deal.setId, number: deal.number ?? deal.key, quantity: 1 }),
    }).catch(() => null);
    if (res?.ok) setGot((g) => new Set(g).add(`${deal.setId}|${deal.key}`));
    else setError((await res?.json().catch(() => ({})))?.error ?? "Couldn't save that — try again.");
  }

  const visible = (data?.deals ?? []).filter((d) => !got.has(`${d.setId}|${d.key}`));
  const deals = order === "best" ? visible : [...visible].sort((a, b) => (order === "price_asc" ? a.lowCents - b.lowCents : b.lowCents - a.lowCents));

  return (
    <>
      <PageHeader
        title="Collection"
        description={
          kind === "products"
            ? "Booster packs, tins, boxes and other sealed products listed under their market price right now."
            : "Cards you're missing that are listed well under their market price right now."
        }
        actions={<CollectionTabs active="deals" />}
      />

      <div className="space-y-5">
        <Segmented
          label="What kind of deal"
          value={kind}
          onChange={(k) => {
            setKind(k);
            setMinPct(k === "products" ? 10 : 25);
            setOrder(k === "products" ? "price_asc" : "best");
          }}
          items={[
            { key: "cards", label: "Cards I'm missing" },
            { key: "products", label: "Packs, tins & boxes" },
          ]}
        />

        <div className="flex flex-wrap items-center justify-between gap-3">
          <Segmented
            label="Which sets"
            value={scope}
            onChange={setScope}
            items={[
              { key: "mine", label: "My sets & Pokémon" },
              { key: "all", label: "Everything" },
            ]}
          />
          <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-muted">
            <select value={order} onChange={(e) => setOrder(e.target.value as Order)} aria-label="Order" className="input">
              {(Object.keys(ORDER_LABELS) as Order[]).map((o) => (
                <option key={o} value={o}>
                  {ORDER_LABELS[o]}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm text-muted">
            At least
            <select value={minPct} onChange={(e) => setMinPct(Number(e.target.value))} aria-label="Smallest discount" className="input">
              {(kind === "products" ? PRODUCT_DISCOUNTS : CARD_DISCOUNTS).map((d) => (
                <option key={d} value={d}>
                  {d}% off
                </option>
              ))}
            </select>
          </label>
          </div>
        </div>

        <p className="rounded-lg border border-line bg-surface-2 px-3 py-2 text-xs text-muted">
          These are <strong className="font-medium text-fg">lowest listings</strong> on TCGplayer, in any condition, against the card&apos;s market price.
          A real deal needs a look at the condition, the seller and shipping. Prices come from the last time each set was loaded
          {data?.pricesAsOf ? ` (the oldest here is ${timeAgo(data.pricesAsOf)})` : ""}, so one may already be gone.
        </p>

        {error && <p className="text-sm text-bad">{error}</p>}

        {loading && !data ? (
          <p className="text-sm text-muted">Looking for deals…</p>
        ) : !data ? (
          <p className="text-sm text-warn">{loadError ?? "Couldn't load deals."}</p>
        ) : deals.length === 0 ? (
          <EmptyState title={data.note ? "Nothing to look at yet." : "No deals right now."}>
            {data.note ??
              `Nothing ${kind === "products" ? "sealed" : "you're missing"} is ${minPct}% or more under market in the ${data.setsConsidered} set${data.setsConsidered === 1 ? "" : "s"} with saved prices. Prices refresh in the background, starting with the sets you collect — or lower the discount.`}
          </EmptyState>
        ) : (
          <>
            <p className="text-xs text-subtle">
              {data.found > deals.length + got.size ? `Showing the best ${deals.length} of ${data.found}.` : `${deals.length} deal${deals.length === 1 ? "" : "s"}.`}
            </p>
            <ul className="card divide-y divide-line">
              {deals.map((d) => (
                <DealRow key={`${d.setId}|${d.key}`} deal={d} onGot={kind === "cards" ? markOwned : undefined} />
              ))}
            </ul>
          </>
        )}
      </div>
    </>
  );
}
