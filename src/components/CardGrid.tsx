"use client";

import { useEffect, useRef, useState } from "react";
import { formatPrice } from "@/lib/labels";
import type { CollectionCard } from "@/lib/collection/progress";
import { safeHref } from "@/lib/security/urls";
import Icon from "./ui/Icon";
import OwnedControl from "./OwnedControl";

interface Props {
  cards: CollectionCard[];
  onChange: (card: CollectionCard, quantity: number) => void;
}

/** The card art, or its number when there's no art. */
function Art({ card, className }: { card: CollectionCard; className: string }) {
  return card.imageUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={card.imageUrl} alt="" loading="lazy" className={className} />
  ) : (
    <div className={`grid place-items-center bg-surface-2 text-xs text-subtle ${className}`}>{card.number}</div>
  );
}

/** TCGdex serves each card at several sizes; the grid uses the small one, the zoomed view the large one. */
const largeImage = (url: string) => url.replace(/\/low\.webp$/, "/high.webp");

/**
 * A larger view of one card. Closes with the X button, Escape, or a click outside the card. It reads
 * the card from the list each render, so owning a copy from inside it updates live.
 */
function Zoom({ card, onClose, onChange }: { card: CollectionCard; onClose: () => void; onChange: Props["onChange"] }) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const [fallback, setFallback] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    // Keep the page from scrolling behind the view.
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [onClose]);

  const src = card.imageUrl ? (fallback ? card.imageUrl : largeImage(card.imageUrl)) : null;
  const link = safeHref(card.tcgplayerUrl);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${card.name}, ${card.number}`}
      onClick={onClose}
      className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-bg/85 p-4 backdrop-blur-sm"
    >
      <div onClick={(e) => e.stopPropagation()} className="relative flex w-full max-w-md flex-col items-center gap-3">
        <button
          ref={closeRef}
          onClick={onClose}
          aria-label="Close"
          className="btn absolute -top-1 right-0 z-10 h-9 w-9 -translate-y-full rounded-full p-0 shadow-md sm:translate-x-12 sm:translate-y-0"
        >
          <Icon name="close" />
        </button>

        <div className="aspect-[5/7] w-full max-w-sm overflow-hidden rounded-xl border border-line bg-surface-2 shadow-xl">
          {src ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={src} alt={card.name} onError={() => setFallback(true)} className="h-full w-full object-contain" />
          ) : (
            <div className="grid h-full place-items-center text-subtle">{card.number}</div>
          )}
        </div>

        <div className="w-full max-w-sm space-y-2 rounded-xl border border-line bg-surface p-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate font-medium">{card.name}</p>
              <p className="truncate text-xs text-subtle">{[card.setName, card.number, card.rarity].filter(Boolean).join(" · ")}</p>
            </div>
            <p className="num shrink-0 text-sm font-semibold">{card.priceCents != null ? formatPrice(card.priceCents) : "—"}</p>
          </div>
          <div className="flex items-center justify-between gap-3">
            {card.owned > 0 ? (
              <OwnedControl owned={card.owned} onChange={(q) => onChange(card, q)} />
            ) : (
              <button onClick={() => onChange(card, 1)} className="btn btn-primary btn-sm">
                <Icon name="plus" className="h-3.5 w-3.5" /> I own this
              </button>
            )}
            {link && (
              <a href={link} target="_blank" rel="noreferrer" className="btn btn-sm">
                TCGplayer <Icon name="external" className="h-3.5 w-3.5" />
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Shared by the grid and the list: which card is zoomed. */
function useZoom(cards: CollectionCard[]) {
  const [zoomKey, setZoomKey] = useState<string | null>(null);
  const zoomed = zoomKey ? (cards.find((c) => c.key === zoomKey) ?? null) : null;
  return { zoomed, open: (c: CollectionCard) => setZoomKey(c.key), close: () => setZoomKey(null) };
}

/**
 * A binder-style grid: every card in the set in print order, the ones you don't have dimmed.
 * Click a card to see it larger; "I own this" marks a missing one, and owned cards get a − n + counter.
 */
export function CardGrid({ cards, onChange }: Props) {
  const { zoomed, open, close } = useZoom(cards);
  return (
    <>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {cards.map((card) => {
          const owned = card.owned > 0;
          return (
            <li key={card.key} className="min-w-0 space-y-1.5">
              <div
                className={`relative aspect-[5/7] overflow-hidden rounded-lg border bg-surface-2 transition-colors ${
                  owned ? "border-good/50" : "border-line"
                }`}
              >
                <button
                  onClick={() => open(card)}
                  aria-label={`View ${card.name} (${card.number}) larger`}
                  className="absolute inset-0 block h-full w-full cursor-zoom-in focus-visible:outline-offset-[-3px]"
                >
                  <Art card={card} className={`h-full w-full object-cover transition ${owned ? "" : "opacity-40 grayscale"}`} />
                </button>
                <div className="pointer-events-none absolute inset-x-0 bottom-2 flex justify-center">
                  <span className="pointer-events-auto shadow-md">
                    {owned ? (
                      <OwnedControl owned={card.owned} onChange={(q) => onChange(card, q)} />
                    ) : (
                      <button
                        onClick={() => onChange(card, 1)}
                        aria-label={`Mark ${card.name} (${card.number}) as owned`}
                        className="btn btn-sm"
                      >
                        <Icon name="plus" className="h-3.5 w-3.5" /> I own this
                      </button>
                    )}
                  </span>
                </div>
              </div>
              <div className="min-w-0 px-0.5">
                <p className="truncate text-sm font-medium leading-tight" title={card.name}>
                  {card.name}
                </p>
                {card.setName && (
                  <p className="truncate text-xs text-muted" title={card.setName}>
                    {card.setName}
                  </p>
                )}
                <p className="num flex items-center justify-between gap-2 text-xs text-subtle">
                  <span className="truncate">{card.number}</span>
                  <span className="shrink-0">{card.priceCents != null ? formatPrice(card.priceCents) : "—"}</span>
                </p>
              </div>
            </li>
          );
        })}
      </ul>
      {zoomed && <Zoom card={zoomed} onClose={close} onChange={onChange} />}
    </>
  );
}

/** The same cards as compact rows (the small picture opens the larger view). */
export function CardList({ cards, onChange }: Props) {
  const { zoomed, open, close } = useZoom(cards);
  return (
    <>
      <ul className="space-y-2">
        {cards.map((card) => (
          <li key={card.key} className={`card flex items-center gap-3 p-2.5 ${card.owned > 0 ? "border-good/40" : ""}`}>
            <button onClick={() => open(card)} aria-label={`View ${card.name} (${card.number}) larger`} className="shrink-0 cursor-zoom-in">
              <Art card={card} className="h-14 w-10 rounded object-cover" />
            </button>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{card.name}</p>
              <p className="truncate text-xs text-subtle">
                {[card.setName, card.number, card.rarity].filter(Boolean).join(" · ")}
                {!card.official && " · not in the official list"}
              </p>
            </div>
            <span className="num w-20 shrink-0 text-right text-sm font-semibold">
              {card.priceCents != null ? formatPrice(card.priceCents) : "—"}
            </span>
            <OwnedControl owned={card.owned} onChange={(q) => onChange(card, q)} />
          </li>
        ))}
      </ul>
      {zoomed && <Zoom card={zoomed} onClose={close} onChange={onChange} />}
    </>
  );
}
