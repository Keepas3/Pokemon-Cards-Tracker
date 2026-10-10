"use client";

import { useState } from "react";
import type { CardCandidateDTO, CardPriceProvider } from "@/lib/clientTypes";
import { cardPriceProviderLabels, formatPrice } from "@/lib/labels";

/**
 * Live search across both card-pricing providers. With `attachToCardId`, a
 * pick attaches a second (or third) price source to that existing card
 * instead of creating a new one — how cross-checking gets set up.
 */
export default function CardSearchBox({
  onAdded,
  attachToCardId,
}: {
  onAdded: () => void;
  attachToCardId?: string;
}) {
  const [query, setQuery] = useState("");
  const [candidates, setCandidates] = useState<CardCandidateDTO[] | null>(null);
  const [providerErrors, setProviderErrors] = useState<Record<string, string>>({});
  const [searching, setSearching] = useState(false);
  const [addingKey, setAddingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function search(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    setSearching(true);
    setError(null);
    const res = await fetch(`/api/cards/search?q=${encodeURIComponent(query)}`);
    const data = await res.json();
    setSearching(false);
    if (!res.ok) {
      setError(data.error ?? "search failed");
      return;
    }
    setCandidates(data.candidates);
    setProviderErrors(data.providerErrors ?? {});
  }

  async function add(candidate: CardCandidateDTO) {
    const key = `${candidate.provider}:${candidate.externalId}`;
    setAddingKey(key);
    setError(null);
    const body = {
      name: candidate.name,
      setName: candidate.setName,
      imageUrl: candidate.imageUrl ?? undefined,
      provider: candidate.provider,
      externalId: candidate.externalId,
      variant: candidate.variant,
      priceCents: candidate.priceCents,
      lowPriceCents: candidate.lowPriceCents,
      url: candidate.url,
    };
    const res = await fetch(attachToCardId ? `/api/cards/${attachToCardId}/sources` : "/api/cards", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setAddingKey(null);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "failed to add");
      return;
    }
    setCandidates(null);
    setQuery("");
    onAdded();
  }

  return (
    <div className="space-y-3">
      <form onSubmit={search} className="flex gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search a card, e.g. Charizard ex"
          className="input flex-1"
        />
        <button
          type="submit"
          disabled={searching}
          className="btn btn-primary"
        >
          {searching ? "Searching…" : "Search"}
        </button>
      </form>

      {error && <p className="text-xs text-bad">{error}</p>}
      {Object.entries(providerErrors).map(([provider, err]) => (
        <p key={provider} className="text-xs text-warn">
          {cardPriceProviderLabels[provider as CardPriceProvider] ?? provider}: {err}
        </p>
      ))}

      {candidates &&
        (candidates.length === 0 ? (
          <p className="text-xs text-subtle">No results.</p>
        ) : (
          <ul className="space-y-2">
            {candidates.map((c) => {
              const key = `${c.provider}:${c.externalId}`;
              return (
                <li
                  key={key}
                  className="flex items-center justify-between gap-3 card p-2 text-sm"
                >
                  <div className="min-w-0">
                    <span className="font-medium">{c.name}</span>{" "}
                    <span className="text-subtle">
                      {c.setName}
                      {c.variant ? ` · ${c.variant}` : ""}
                    </span>
                    <div className="text-xs text-subtle">
                      {cardPriceProviderLabels[c.provider]} · {formatPrice(c.priceCents)}
                    </div>
                  </div>
                  <button
                    onClick={() => add(c)}
                    disabled={addingKey === key}
                    className="btn btn-primary btn-sm shrink-0"
                  >
                    {addingKey === key ? "Adding…" : "Add"}
                  </button>
                </li>
              );
            })}
          </ul>
        ))}
    </div>
  );
}
