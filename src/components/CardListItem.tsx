"use client";

import { useState } from "react";
import type { CardDTO } from "@/lib/clientTypes";
import CardPriceSourcePill from "./CardPriceSourcePill";
import CardWatchControl from "./CardWatchControl";
import CardSearchBox from "./CardSearchBox";

export default function CardListItem({ card, onChanged }: { card: CardDTO; onChanged: () => void }) {
  const [addingSource, setAddingSource] = useState(false);

  async function deleteCard() {
    if (!confirm(`Stop tracking "${card.name}"?`)) return;
    await fetch(`/api/cards/${card.id}`, { method: "DELETE" });
    onChanged();
  }

  async function deleteSource(id: string) {
    await fetch(`/api/card-sources/${id}`, { method: "DELETE" });
    onChanged();
  }

  return (
    <div className="card p-4">
      <div className="flex items-start gap-4">
        {card.imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={card.imageUrl} alt="" className="h-16 w-16 shrink-0 rounded object-contain bg-surface-2" />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h3 className="font-medium">{card.name}</h3>
              <p className="text-xs text-subtle">
                {card.setName}
                {card.number ? ` · #${card.number}` : ""}
              </p>
            </div>
            <CardWatchControl cardId={card.id} watchlist={card.watchlist} onChanged={onChanged} />
          </div>

          <div className="mt-3 space-y-2">
            {card.priceSources.map((s) => (
              <CardPriceSourcePill key={s.id} source={s} onDelete={() => deleteSource(s.id)} />
            ))}
            {card.priceSources.length === 0 && (
              <p className="text-xs text-subtle">No price sources tracked yet.</p>
            )}
          </div>

          <div className="mt-2 flex items-start justify-between gap-2">
            {addingSource ? (
              <div className="flex-1">
                <CardSearchBox
                  attachToCardId={card.id}
                  onAdded={() => {
                    setAddingSource(false);
                    onChanged();
                  }}
                />
              </div>
            ) : (
              <button onClick={() => setAddingSource(true)} className="text-xs text-subtle hover:text-fg">
                + cross-check with another source
              </button>
            )}
            <button onClick={deleteCard} className="shrink-0 text-xs text-subtle hover:text-bad">
              delete card
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
