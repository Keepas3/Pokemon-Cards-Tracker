"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { formatDate, formatPrice } from "@/lib/labels";
import type { GalleryPayload, GallerySetDTO } from "@/lib/collection/types";
import { moveItem } from "@/lib/collection/order";
import { storedImageSrc } from "@/lib/images/rules";
import { useApi } from "@/lib/useApi";
import EmptyState from "./ui/EmptyState";
import CollectionTabs from "./CollectionTabs";
import Icon from "./ui/Icon";
import LogoImage from "./ui/LogoImage";
import PageHeader from "./ui/PageHeader";
import ProgressBar from "./ui/ProgressBar";
import Segmented from "./ui/Segmented";
import Stat from "./ui/Stat";

interface TileDrag {
  /** This tile is the one being dragged. */
  dragging: boolean;
  /** Another tile of this series is being dragged over this one. */
  over: boolean;
  onStart: (e: React.DragEvent) => void;
  onEnd: () => void;
  onOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  /** Arrow keys on the handle: -1 earlier, +1 later. */
  onNudge: (by: -1 | 1) => void;
}

function SetTile({ set, drag }: { set: GallerySetDTO; drag: TileDrag }) {
  const started = set.ownedCards > 0;
  const complete = set.percent === 100;
  return (
    <div
      className={`relative min-w-0 transition ${drag.dragging ? "opacity-40" : ""} ${drag.over ? "rounded-xl ring-2 ring-accent" : ""}`}
      onDragOver={drag.onOver}
      onDrop={drag.onDrop}
    >
    <Link
      href={`/collection/${set.slug}`}
      draggable={false}
      className={`group card flex h-full flex-col overflow-hidden transition hover:border-line-strong hover:shadow-md ${complete ? "border-good/50" : ""}`}
    >
      <div className="flex h-24 items-center justify-center bg-surface-2 p-3">
        <LogoImage
          key={set.logoUrl ?? "none"}
          src={set.logoUrl ?? ""}
          className="logo-img h-full w-full object-contain transition duration-300 group-hover:scale-105"
          fallback={
            set.artUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={storedImageSrc(set.artUrl)} alt="" loading="lazy" className="h-full w-full object-contain" />
            ) : (
              <span className="line-clamp-2 text-center text-sm font-semibold text-muted">{set.name}</span>
            )
          }
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
      <button
        draggable
        onDragStart={drag.onStart}
        onDragEnd={drag.onEnd}
        onKeyDown={(e) => {
          const by = e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : 0;
          if (by === 0) return;
          e.preventDefault();
          drag.onNudge(by);
        }}
        aria-label={`Move ${set.name}: drag, or use the arrow keys`}
        title="Drag to rearrange (or use the arrow keys)"
        className="absolute right-1.5 top-1.5 cursor-grab rounded bg-surface/80 p-1 text-subtle opacity-70 backdrop-blur transition hover:text-fg hover:opacity-100 focus-visible:opacity-100 active:cursor-grabbing"
      >
        <Icon name="grip" className="h-4 w-4" />
      </button>
    </div>
  );
}

type Filter = "started" | "all";
type Progress = "all" | "open" | "done";

export default function Collection() {
  const { data, error, loading } = useApi<GalleryPayload>("/api/collection");
  const [filter, setFilter] = useState<Filter | null>(null);
  const [query, setQuery] = useState("");
  const [progress, setProgress] = useState<Progress>("all");
  // The order a person has dragged each series into (by series id → every set's slug), shown at once and saved.
  const [custom, setCustom] = useState<Record<string, string[]>>({});
  const [dragging, setDragging] = useState<{ seriesId: string; slug: string } | null>(null);
  const [overSlug, setOverSlug] = useState<string | null>(null);
  const [orderError, setOrderError] = useState<string | null>(null);

  const startedCount = data?.totals.started ?? 0;
  // Until you choose, show your sets if you have any, otherwise everything.
  const active: Filter = filter ?? (startedCount > 0 ? "started" : "all");

  // Every series with its sets in the order to show (the saved order, plus any drag made on this page).
  const ordered = useMemo(
    () =>
      (data?.series ?? []).map((s) => {
        const wanted = custom[s.id];
        if (!wanted) return s;
        const bySlug = new Map(s.sets.map((set) => [set.slug, set]));
        const known = wanted.filter((slug) => bySlug.has(slug));
        const rest = s.sets.filter((set) => !wanted.includes(set.slug));
        return { ...s, sets: [...rest, ...known.map((slug) => bySlug.get(slug)!)] };
      }),
    [data, custom],
  );

  const series = useMemo(() => {
    const q = query.trim().toLowerCase();
    return ordered
      .map((s) => ({
        ...s,
        sets: s.sets.filter(
          (set) =>
            (active === "all" || set.ownedCards > 0) &&
            (progress === "all" || (progress === "done" ? set.percent === 100 : set.percent !== 100)) &&
            (!q || set.name.toLowerCase().includes(q)),
        ),
      }))
      .filter((s) => s.sets.length > 0);
  }, [ordered, active, progress, query]);

  /** Moves one set of a series to where another is, and saves the whole series' order. */
  async function moveSet(seriesId: string, fromSlug: string, toSlug: string) {
    const current = ordered.find((s) => s.id === seriesId)?.sets.map((x) => x.slug) ?? [];
    const next = moveItem(current, current.indexOf(fromSlug), current.indexOf(toSlug));
    if (next.join() === current.join()) return;
    const before = custom[seriesId];
    setCustom((c) => ({ ...c, [seriesId]: next }));
    setOrderError(null);
    const res = await fetch("/api/collection/order", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slugs: next }),
    }).catch(() => null);
    if (!res?.ok) {
      setCustom((c) => {
        const copy = { ...c };
        if (before) copy[seriesId] = before;
        else delete copy[seriesId];
        return copy;
      });
      setOrderError("Couldn't save that order — try again.");
    }
  }

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
          <Segmented
            label="Progress"
            value={progress}
            onChange={setProgress}
            items={[
              { key: "all", label: "Any progress" },
              { key: "open", label: "Not finished" },
              { key: "done", label: "Finished", count: data.totals.complete },
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

        {orderError && <p className="text-sm text-bad">{orderError}</p>}

        {series.length === 0 ? (
          active === "started" && !query ? (
            <EmptyState title="You haven't started a set yet.">
              Choose <span className="font-medium text-fg">All sets</span>, open one, and tap the cards you own — or use{" "}
              <span className="font-medium text-fg">Log a pull</span> to type in what you opened.
            </EmptyState>
          ) : progress === "done" && !query ? (
            <EmptyState title="No finished sets yet.">A set shows here once you own every card in it.</EmptyState>
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
                {s.sets.map((set) => {
                  const sameSeries = dragging?.seriesId === s.id;
                  return (
                    <SetTile
                      key={set.slug}
                      set={set}
                      drag={{
                        dragging: sameSeries && dragging?.slug === set.slug,
                        over: sameSeries && overSlug === set.slug && dragging?.slug !== set.slug,
                        onStart: (e) => {
                          e.dataTransfer.effectAllowed = "move";
                          e.dataTransfer.setData("text/plain", set.slug);
                          const tile = (e.currentTarget as HTMLElement).parentElement;
                          if (tile) e.dataTransfer.setDragImage(tile, 24, 24);
                          setDragging({ seriesId: s.id, slug: set.slug });
                        },
                        onEnd: () => {
                          setDragging(null);
                          setOverSlug(null);
                        },
                        onOver: (e) => {
                          if (!sameSeries) return;
                          e.preventDefault();
                          e.dataTransfer.dropEffect = "move";
                          if (overSlug !== set.slug) setOverSlug(set.slug);
                        },
                        onDrop: (e) => {
                          if (!sameSeries || !dragging) return;
                          e.preventDefault();
                          const from = dragging.slug;
                          setDragging(null);
                          setOverSlug(null);
                          void moveSet(s.id, from, set.slug);
                        },
                        onNudge: (by) => {
                          // Step over the sets you can see, so a filter doesn't make the arrow keys jump past hidden ones.
                          const list = s.sets;
                          const i = list.findIndex((x) => x.slug === set.slug);
                          const target = list[i + by];
                          if (target) void moveSet(s.id, set.slug, target.slug);
                        },
                      }}
                    />
                  );
                })}
              </div>
            </section>
          ))
        )}

        <p className="text-xs text-subtle">Prices are up to 12 hours old.</p>
      </div>
    </>
  );
}
