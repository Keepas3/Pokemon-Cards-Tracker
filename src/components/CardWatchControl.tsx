"use client";

import { useState } from "react";
import type { CardWatchlistEntryDTO } from "@/lib/clientTypes";
import Icon from "./ui/Icon";

/**
 * Add/edit/remove a card's watchlist entry: a price threshold to be pinged at.
 */
export default function CardWatchControl({
  cardId,
  watchlist,
  onChanged,
}: {
  cardId: string;
  watchlist: CardWatchlistEntryDTO | null | undefined;
  onChanged: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [threshold, setThreshold] = useState(
    watchlist?.thresholdCents != null ? (watchlist.thresholdCents / 100).toFixed(2) : "",
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const thresholdCents = threshold.trim() ? Math.round(parseFloat(threshold) * 100) : NaN;
    if (Number.isNaN(thresholdCents)) {
      setError("enter a price");
      return;
    }
    setSaving(true);
    setError(null);

    const res = await fetch(watchlist ? `/api/cards/watchlist/${cardId}` : "/api/cards/watchlist", {
      method: watchlist ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cardId, thresholdCents }),
    });

    setSaving(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "failed to save");
      return;
    }
    setOpen(false);
    onChanged();
  }

  async function unwatch() {
    if (!confirm("Stop watching this card's price?")) return;
    await fetch(`/api/cards/watchlist/${cardId}`, { method: "DELETE" });
    onChanged();
  }

  if (!open) {
    if (!watchlist) {
      return (
        <button
          onClick={() => setOpen(true)}
          className="btn btn-sm"
        >
          + Watch
        </button>
      );
    }
    return (
      <div className="flex items-center gap-2 text-xs">
        <span className="chip chip-accent num">
          <Icon name="watchlist" className="h-3 w-3" /> alert ≤ ${(watchlist.thresholdCents / 100).toFixed(2)}
        </span>
        <button onClick={() => setOpen(true)} className="text-subtle hover:text-fg">
          edit
        </button>
        <button onClick={unwatch} className="btn btn-ghost btn-sm hover:text-bad">
          remove
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={save} className="flex flex-wrap items-center gap-2 card p-2 text-xs">
      <label className="flex items-center gap-1">
        Alert when ≤ $
        <input
          type="number"
          step="0.01"
          min="0"
          required
          value={threshold}
          onChange={(e) => setThreshold(e.target.value)}
          className="input w-20 px-2 py-1 text-xs"
          autoFocus
        />
      </label>
      {error && <span className="text-bad">{error}</span>}
      <button
        type="submit"
        disabled={saving}
        className="btn btn-primary btn-sm"
      >
        {saving ? "Saving…" : "Save"}
      </button>
      <button type="button" onClick={() => setOpen(false)} className="text-subtle hover:text-muted">
        Cancel
      </button>
    </form>
  );
}
