"use client";

import { useMemo, useRef, useState } from "react";
import { formatPrice } from "@/lib/labels";
import { matchPull } from "@/lib/collection/progress";
import type { CollectionCard } from "@/lib/collection/progress";

interface Props {
  cards: CollectionCard[];
  /** Saves a new total of copies for one card; resolves false if it couldn't be saved. */
  onSetOwned: (card: CollectionCard, quantity: number) => Promise<boolean>;
}

/**
 * Logs what you pulled: type a card number ("25", "025/088") or part of a name,
 * press Enter, and one copy is added. If the entry could mean several cards
 * they're listed to pick from instead of guessing.
 */
export default function PullLogger({ cards, onSetOwned }: Props) {
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState<{ text: string; undo?: () => void } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { cards: matches, more } = useMemo(() => matchPull(query, cards), [query, cards]);
  const onlyOne = matches.length === 1 ? matches[0] : null;

  async function add(card: CollectionCard) {
    const before = card.owned;
    const ok = await onSetOwned(card, before + 1);
    if (!ok) {
      setMessage({ text: "Couldn't save that — try again." });
      return;
    }
    setMessage({
      text: `Added ${card.name} (${card.number}) — you now have ${before + 1}.`,
      undo: () => {
        void onSetOwned(card, before);
        setMessage({ text: `Undid that: ${card.name} back to ${before}.` });
      },
    });
    setQuery("");
    inputRef.current?.focus();
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key !== "Enter") return;
    e.preventDefault();
    if (onlyOne) void add(onlyOne);
    else if (query.trim() && matches.length === 0) setMessage({ text: `No card here matches “${query.trim()}”.` });
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor="pull-logger" className="text-sm font-medium">
          Log a pull
        </label>
        <input
          id="pull-logger"
          ref={inputRef}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setMessage(null);
          }}
          onKeyDown={onKeyDown}
          placeholder="Card number or name, then Enter"
          autoComplete="off"
          className="input w-72 max-w-full"
        />
        <span className="text-xs text-subtle">{onlyOne ? "Enter adds one" : matches.length > 1 ? "Pick one below" : ""}</span>
      </div>

      {matches.length > 1 && (
        <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line">
          {matches.map((c) => (
            <li key={c.key}>
              <button
                onClick={() => void add(c)}
                className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-surface-2"
              >
                <span className="min-w-0 truncate">
                  <span className="text-subtle">{c.number}</span> {c.name}
                </span>
                <span className="num shrink-0 text-xs text-subtle">
                  {formatPrice(c.priceCents)}
                  {c.owned > 0 && <span className="ml-2 text-good">own {c.owned}</span>}
                </span>
              </button>
            </li>
          ))}
          {more > 0 && <li className="px-3 py-1.5 text-xs text-subtle">…and {more} more — keep typing to narrow it down.</li>}
        </ul>
      )}

      {message && (
        <p className="text-xs text-muted">
          {message.text}
          {message.undo && (
            <button onClick={message.undo} className="link ml-2">
              Undo
            </button>
          )}
        </p>
      )}
    </div>
  );
}
