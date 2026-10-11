"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import type { TodayPayload } from "@/lib/clientTypes";
import { digestIsEmpty } from "@/lib/digest/types";
import { formatPrice, timeAgo } from "@/lib/labels";
import { safeHref } from "@/lib/security/urls";
import { useApi } from "@/lib/useApi";
import ApiStatus from "./ApiStatus";
import { DealRow } from "./Deals";
import EmptyState from "./ui/EmptyState";
import Icon from "./ui/Icon";
import PageHeader from "./ui/PageHeader";
import Stat from "./ui/Stat";

function Feed({ title, count, children }: { title: string; count?: number; children: ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="flex items-baseline gap-2 text-xs font-medium uppercase tracking-wide text-subtle">
        {title}
        {count != null && <span className="num normal-case tracking-normal">{count}</span>}
      </h2>
      <div className="card divide-y divide-line">{children}</div>
    </section>
  );
}

function hourLabel(h: number): string {
  return `${h % 12 === 0 ? 12 : h % 12}:00 ${h < 12 ? "AM" : "PM"}`;
}

const today = () =>
  new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });

export default function Today() {
  const { data, error, loading } = useApi<TodayPayload>("/api/today");

  if (loading && !data) {
    return (
      <>
        <PageHeader title="Today" />
        <p className="text-sm text-muted">Checking what changed…</p>
      </>
    );
  }
  if (!data) {
    return (
      <>
        <PageHeader title="Today" />
        <p className="text-sm text-warn">{error ?? "Couldn't load Today."}</p>
      </>
    );
  }

  const { digest, smartWatches } = data;
  const deals = data.deals ?? [];
  // Packs, tins & boxes: the best few deals, shown cheapest first.
  const productDeals = [...(data.productDeals ?? [])].sort((a, b) => a.lowCents - b.lowCents);
  const dealCount = (data.dealsFound ?? 0) + (data.productDealsFound ?? 0);
  const empty = digestIsEmpty(digest) && deals.length === 0 && productDeals.length === 0;
  const activeAlerts = smartWatches.filter((w) => w.enabled);
  const matchCount = digest.smartAlerts.reduce((n, g) => n + g.items.length, 0);

  return (
    <>
      <PageHeader
        title="Today"
        description={`${today()} — what changed across the things you're watching in the last 24 hours.`}
        actions={
          <Link href="/history" className="btn btn-ghost">
            <Icon name="clock" /> All activity
          </Link>
        }
      />

      <div className="grid grid-cols-[minmax(0,1fr)] gap-8 lg:grid-cols-[minmax(0,1fr)_17rem]">
        <div className="space-y-6">
          <div className="grid grid-cols-3 gap-3">
            <Stat label="Deals" value={dealCount} tone={dealCount > 0 ? "good" : "default"} />
            <Stat label="Alert matches" value={matchCount} tone={matchCount > 0 ? "accent" : "default"} />
            <Stat label="Price moves" value={digest.cardMoves.length} />
          </div>

          {empty && (
            <EmptyState title="Nothing new in the last 24 hours.">
              That&apos;s normal when nothing you watch has moved. Mark cards you own in the{" "}
              <Link href="/collection" className="link">
                collection
              </Link>{" "}
              so deals on what you&apos;re missing show up here, add cards to your{" "}
              <Link href="/watchlist?tab=cards" className="link">
                watchlist
              </Link>
              , or save a smart alert from any set page on{" "}
              <Link href="/browse" className="link">
                Browse
              </Link>
              .
            </EmptyState>
          )}

          {productDeals.length > 0 && (
            <section className="space-y-2">
              <h2 className="flex items-baseline justify-between gap-2 text-xs font-medium uppercase tracking-wide text-subtle">
                <span>
                  Deals on packs, tins &amp; boxes <span className="num normal-case tracking-normal">{data.productDealsFound}</span>
                </span>
                <Link href="/collection/deals?kind=products" className="link normal-case tracking-normal">
                  See all
                </Link>
              </h2>
              <ul className="card divide-y divide-line">
                {productDeals.map((d) => (
                  <DealRow key={`${d.setId}|${d.key}`} deal={d} />
                ))}
              </ul>
            </section>
          )}

          {deals.length > 0 && (
            <section className="space-y-2">
              <h2 className="flex items-baseline justify-between gap-2 text-xs font-medium uppercase tracking-wide text-subtle">
                <span>
                  Deals on cards you&apos;re missing <span className="num normal-case tracking-normal">{data.dealsFound}</span>
                </span>
                <Link href="/collection/deals" className="link normal-case tracking-normal">
                  See all
                </Link>
              </h2>
              <ul className="card divide-y divide-line">
                {deals.map((d) => (
                  <DealRow key={`${d.setId}|${d.key}`} deal={d} />
                ))}
              </ul>
            </section>
          )}

          {digest.smartAlerts.length > 0 && (
            <Feed title="Smart alert matches" count={matchCount}>
              {digest.smartAlerts.map((g, i) => (
                <div key={i} className="space-y-1.5 px-4 py-3">
                  <p className="font-medium">{g.watchName}</p>
                  <ul className="space-y-1">
                    {g.items.slice(0, 8).map((item, j) => (
                      <li key={j} className="flex justify-between gap-3">
                        <a href={safeHref(item.url)} target="_blank" rel="noreferrer" className="truncate text-muted hover:text-fg hover:underline">
                          {item.name}
                        </a>
                        <span className="num shrink-0 text-accent-text">{formatPrice(item.priceCents)}</span>
                      </li>
                    ))}
                  </ul>
                  {g.items.length > 8 && <p className="text-xs text-subtle">…and {g.items.length - 8} more</p>}
                </div>
              ))}
            </Feed>
          )}

          {digest.cardMoves.length > 0 && (
            <Feed title="Watched card price moves" count={digest.cardMoves.length}>
              {digest.cardMoves.map((m, i) => {
                const down = m.toCents < m.fromCents;
                return (
                  <div key={i} className="flex items-center justify-between gap-3 px-4 py-3">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{m.cardName}</p>
                      <p className="text-xs text-subtle">
                        {m.setName}
                        {m.thresholdCents != null && ` · your alert ≤ ${formatPrice(m.thresholdCents)}`}
                      </p>
                    </div>
                    <span className={`num shrink-0 ${down ? "text-good" : "text-warn"}`}>
                      {down ? "▼" : "▲"} {formatPrice(m.fromCents)} → {formatPrice(m.toCents)}
                    </span>
                  </div>
                );
              })}
            </Feed>
          )}

        </div>

        <aside className="space-y-6">
          <section className="space-y-2">
            <h2 className="text-xs font-medium uppercase tracking-wide text-subtle">Morning digest</h2>
            <div className="card space-y-1 px-4 py-3 text-sm">
              {data.digestEnabled ? (
                <>
                  <p className="font-medium">On · {hourLabel(data.digestHour)}</p>
                  <p className="text-xs text-subtle">
                    {data.lastDigestAt ? `Last sent ${timeAgo(data.lastDigestAt)}` : "Not sent yet"}
                  </p>
                  {!data.hasWebhook && (
                    <p className="text-xs text-warn">No Discord webhook is set up, so it can&apos;t send.</p>
                  )}
                </>
              ) : (
                <>
                  <p className="font-medium text-muted">Off</p>
                  <Link href="/settings" className="link text-xs">
                    Turn it on in Settings
                  </Link>
                </>
              )}
            </div>
          </section>

          <section className="space-y-2">
            <h2 className="text-xs font-medium uppercase tracking-wide text-subtle">Your alerts</h2>
            <div className="card divide-y divide-line">
              {activeAlerts.length === 0 ? (
                <p className="px-4 py-3 text-sm text-muted">
                  None yet. Open a set on{" "}
                  <Link href="/browse" className="link">
                    Browse
                  </Link>{" "}
                  and save its filters as an alert.
                </p>
              ) : (
                activeAlerts.map((w) => (
                  <div key={w.id} className="px-4 py-2.5">
                    <p className="truncate text-sm">{w.name}</p>
                    <p className="text-xs text-subtle">
                      {w.matchCount} matching now · prices {w.setItemsFetchedAt ? timeAgo(w.setItemsFetchedAt) : "not loaded"}
                    </p>
                  </div>
                ))
              )}
              <Link href="/watchlist?tab=alerts" className="flex items-center justify-between px-4 py-2.5 text-xs text-muted hover:text-fg">
                Manage alerts <Icon name="arrow" className="h-3.5 w-3.5" />
              </Link>
            </div>
          </section>

          <ApiStatus error={null} budget={data.budget} />
        </aside>
      </div>
    </>
  );
}
