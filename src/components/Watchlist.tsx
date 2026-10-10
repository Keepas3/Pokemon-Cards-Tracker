"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { CardDTO, CardWatchlistEntryDTO, SmartWatchDTO } from "@/lib/clientTypes";
import CardListItem from "./CardListItem";
import CardSearchBox from "./CardSearchBox";
import SmartAlerts from "./SmartAlerts";
import EmptyState from "./ui/EmptyState";
import Icon from "./ui/Icon";
import PageHeader from "./ui/PageHeader";
import Segmented from "./ui/Segmented";

export type WatchlistTab = "cards" | "alerts";

// /api/cards names the watch entry `watchlistEntry`; the card components read `watchlist`.
type ApiCard = CardDTO & { watchlistEntry?: CardWatchlistEntryDTO | null };
const normalize = (c: ApiCard): CardDTO => ({ ...c, watchlist: c.watchlistEntry ?? null });

async function loadAll() {
  const [cards, alerts] = await Promise.all([
    fetch("/api/cards").then((r) => r.json()),
    fetch("/api/smart-watches").then((r) => r.json()),
  ]);
  return {
    // Watched cards first: those are the ones that will ping you.
    cards: ((cards.cards as ApiCard[]) ?? []).map(normalize).sort((a, b) => Number(!!b.watchlist) - Number(!!a.watchlist)),
    alerts: (alerts.smartWatches as SmartWatchDTO[]) ?? [],
  };
}

export default function Watchlist({ initialTab }: { initialTab: WatchlistTab }) {
  const [tab, setTab] = useState<WatchlistTab>(initialTab);
  const [cards, setCards] = useState<CardDTO[] | null>(null);
  const [alerts, setAlerts] = useState<SmartWatchDTO[] | null>(null);
  const [checking, setChecking] = useState(false);
  const [lastCheckMsg, setLastCheckMsg] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const all = await loadAll();
    setCards(all.cards);
    setAlerts(all.alerts);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const all = await loadAll();
      if (cancelled) return;
      setCards(all.cards);
      setAlerts(all.alerts);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function checkNow() {
    setChecking(true);
    setLastCheckMsg(null);
    const cardPollRes = await fetch("/api/cards/poll", { method: "POST" }).then((r) => r.json());
    setChecking(false);
    const priceChanges = cardPollRes.results?.filter((r: { priceChanged: boolean }) => r.priceChanged).length ?? 0;
    setLastCheckMsg(`Checked ${cardPollRes.results?.length ?? 0} card price(s); ${priceChanges} changed.`);
    refresh();
  }

  return (
    <>
      <PageHeader
        title="Watchlist"
        description="Cards you want to hear about when their price drops, and set-wide alerts. (Deals on the cards you're missing are under Collection.)"
        actions={
          <button onClick={checkNow} disabled={checking} className="btn btn-primary">
            <Icon name="refresh" /> {checking ? "Checking…" : "Check now"}
          </button>
        }
      />
      {lastCheckMsg && <p className="-mt-3 mb-5 text-xs text-muted">{lastCheckMsg}</p>}

      <div className="mb-5">
        <Segmented
          label="Watchlist section"
          value={tab}
          onChange={setTab}
          items={[
            { key: "cards", label: "Cards", count: cards?.length },
            { key: "alerts", label: "Alerts", count: alerts?.length },
          ]}
        />
      </div>

      {tab === "cards" && (
        <div className="space-y-5">
          <div className="card space-y-3 p-4">
            <h2 className="text-sm font-semibold">Add a card</h2>
            <CardSearchBox onAdded={refresh} />
            <p className="text-xs text-subtle">
              Searches tcgapi.dev. You can also watch a card straight from any set page on{" "}
              <Link href="/browse" className="link">
                Browse
              </Link>
              .
            </p>
          </div>
          {cards == null ? (
            <p className="text-sm text-muted">Loading…</p>
          ) : cards.length === 0 ? (
            <EmptyState title="No cards tracked yet.">Search for one above to start tracking its price.</EmptyState>
          ) : (
            <div className="space-y-3">
              {cards.map((c) => (
                <CardListItem key={c.id} card={c} onChanged={refresh} />
              ))}
            </div>
          )}
        </div>
      )}

      {tab === "alerts" && <SmartAlerts alerts={alerts} onChanged={refresh} />}
    </>
  );
}
