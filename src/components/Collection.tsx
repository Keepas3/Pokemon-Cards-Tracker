"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { formatDate, formatPrice } from "@/lib/labels";
import type { GalleryPayload, GallerySetDTO } from "@/lib/collection/types";
import { useApi } from "@/lib/useApi";
import EmptyState from "./ui/EmptyState";
import CollectionTabs from "./CollectionTabs";
import Icon from "./ui/Icon";
import LogoImage from "./ui/LogoImage";
import PageHeader from "./ui/PageHeader";
import ProgressBar from "./ui/ProgressBar";
import Segmented from "./ui/Segmented";
import Stat from "./ui/Stat";

function SetTile({ set }: { set: GallerySetDTO }) {
  const started = set.ownedCards > 0;
  const complete = set.percent === 100;
  return (
    <Link
      href={`/collection/${set.slug}`}
      className={`group card flex flex-col overflow-hidden transition hover:border-line-strong hover:shadow-md ${complete ? "border-good/50" : ""}`}
    >
      <div className="flex h-24 items-center justify-center bg-surface-2 p-3">
        <LogoImage
          key={set.logoUrl ?? "none"}
          src={set.logoUrl ?? ""}
          className="logo-img h-full w-full object-contain transition duration-300 group-hover:scale-105"
          fallback={<span className="line-clamp-2 text-center text-sm font-semibold text-muted">{set.name}</span>}
        />
      </div>
      <div className="flex flex-1 flex-col gap-1.5 p-3">
        <p className="line-clamp-2 text-sm font-medium leading-snug" title={set.name}>
          {set.name}
        </p>
        <p className="num text-xs text-subtle">
          {set.releaseDate ? formatDate(set.releaseDate) : "Release date unknown"}
          {set.totalCards != null && ` · ${set.totalCards} cards`}
        </p>
        {started && (
          <div className="mt-auto space-y-1 pt-1.5">
            {set.totalCards ? (
              <>
                <ProgressBar value={set.ownedCards} max={set.totalCards} label={`${set.name} completion`} complete={complete} />
                <p className="num text-xs text-muted">
                  {set.ownedCards} / {set.totalCards}
                  {set.percent != null && ` · ${set.percent}%`}
                </p>
              </>
            ) : (
              <p className="num text-xs text-muted">{set.ownedCards} owned</p>
            )}
          </div>
        )}
      </div>
    </Link>
  );
}

type Filter = "started" | "all";

export default function Collection() {
  const { data, error, loading } = useApi<GalleryPayload>("/api/collection");
  const [filter, setFilter] = useState<Filter | null>(null);
  const [query, setQuery] = useState("");

  const startedCount = data?.totals.started ?? 0;
  // Until you choose, show your sets if you have any, otherwise everything.
  const active: Filter = filter ?? (startedCount > 0 ? "started" : "all");

  const series = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (data?.series ?? [])
      .map((s) => ({
        ...s,
        sets: s.sets.filter((set) => (active === "all" || set.ownedCards > 0) && (!q || set.name.toLowerCase().includes(q))),
      }))
      .filter((s) => s.sets.length > 0);
  }, [data, active, query]);

  const header = (
    <PageHeader
      title="Collection"
      description="Every set, grouped by series. Open one to see its full card list and mark what you own — a card counts in any printing."
      actions={<CollectionTabs active="sets" />}
    />
  );

  if (loading && !data) {
    return (
      <>
        {header}
        <p className="text-sm text-muted">Loading the set catalog… the first time, this takes a few seconds.</p>
      </>
    );
  }
  if (!data) {
    return (
      <>
        {header}
        <p className="text-sm text-warn">{error ?? "Couldn't load your collection."}</p>
      </>
    );
  }

  const allCount = data.series.reduce((n, s) => n + s.sets.length, 0);

  return (
    <>
      {header}
      <div className="space-y-6">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Sets started" value={data.totals.started} />
          <Stat label="Complete" value={data.totals.complete} tone={data.totals.complete > 0 ? "good" : "default"} />
          <Stat label="Cards owned" value={data.totals.copies} />
          <Stat label="Worth" value={formatPrice(data.totals.valueCents)} />
        </div>

        {data.error && (
          <p className="rounded-lg border border-warn/30 bg-warn-soft px-3 py-2 text-xs text-warn">
            {data.error} Sets are listed without logos or full card lists until it&apos;s back.
          </p>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <Segmented
            label="Which sets"
            value={active}
            onChange={setFilter}
            items={[
              { key: "started", label: "Started", count: startedCount },
              { key: "all", label: "All sets", count: allCount },
            ]}
          />
          <div className="relative">
            <Icon name="search" className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search sets, e.g. 30th"
              aria-label="Search sets"
              className="input w-52 pl-8"
            />
          </div>
        </div>

        {series.length === 0 ? (
          active === "started" && !query ? (
            <EmptyState title="You haven't started a set yet.">
              Choose <span className="font-medium text-fg">All sets</span>, open one, and tap the cards you own — or use{" "}
              <span className="font-medium text-fg">Log a pull</span> to type in what you opened.
            </EmptyState>
          ) : (
            <EmptyState title="No sets match that." />
          )
        ) : (
          series.map((s) => (
            <section key={s.id} className="space-y-3">
              <h2 className="flex items-baseline gap-2 text-xs font-medium uppercase tracking-wide text-subtle">
                {s.name}
                <span className="num normal-case tracking-normal">{s.sets.length}</span>
              </h2>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {s.sets.map((set) => (
                  <SetTile key={set.slug} set={set} />
                ))}
              </div>
            </section>
          ))
        )}

        <p className="text-xs text-subtle">
          Set lists, logos and card lists come from{" "}
          <a href="https://tcgdex.dev" target="_blank" rel="noreferrer" className="link">
            TCGdex
          </a>
          ; prices from tcgapi.dev (up to 12 hours old).
        </p>
      </div>
    </>
  );
}
