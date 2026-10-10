"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import type { CardPriceEventDTO } from "@/lib/clientTypes";
import { cardPriceProviderLabels, formatPrice, timeAgo } from "@/lib/labels";
import EmptyState from "./ui/EmptyState";
import PageHeader from "./ui/PageHeader";

function Log({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="text-xs font-medium uppercase tracking-wide text-subtle">{title}</h2>
      {children}
    </section>
  );
}

export default function History() {
  const [cardEvents, setCardEvents] = useState<CardPriceEventDTO[] | null>(null);

  useEffect(() => {
    fetch("/api/card-events?limit=100")
      .then((r) => r.json())
      .then((d) => setCardEvents(d.events));
  }, []);

  return (
    <>
      <PageHeader
        back={{ href: "/", label: "Today" }}
        title="All activity"
        description="Every price change recorded on the cards you watch."
      />

      <div className="space-y-8">
        <Log title="Watched cards">
          {cardEvents == null ? (
            <p className="text-sm text-muted">Loading…</p>
          ) : cardEvents.length === 0 ? (
            <EmptyState title="No price changes recorded yet." />
          ) : (
            <ul className="card divide-y divide-line">
              {cardEvents.map((e) => {
                const dropped =
                  e.oldPriceCents == null || e.newPriceCents == null ? null : e.newPriceCents < e.oldPriceCents;
                return (
                  <li key={e.id} className="flex items-center justify-between gap-3 px-4 py-3">
                    <div className="min-w-0 space-y-0.5">
                      <p>
                        <span className="font-medium">{e.cardPriceSource.card.name}</span>{" "}
                        <span className="text-subtle">via {cardPriceProviderLabels[e.cardPriceSource.provider]}</span>
                      </p>
                      <p className="flex flex-wrap items-center gap-2 text-xs">
                        <span className={`chip ${dropped === true ? "chip-good" : dropped === false ? "chip-warn" : ""}`}>
                          {dropped === true ? "Price dropped" : dropped === false ? "Price rose" : "Price updated"}
                        </span>
                        <span className="num text-subtle">
                          {formatPrice(e.oldPriceCents)} → {formatPrice(e.newPriceCents)}
                        </span>
                        {e.notified && <span className="text-subtle">notified</span>}
                      </p>
                    </div>
                    <span className="shrink-0 text-xs text-subtle">{timeAgo(e.createdAt)}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </Log>
      </div>
    </>
  );
}
