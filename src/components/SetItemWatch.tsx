"use client";

import { useState } from "react";
import type { SetItemDTO } from "@/lib/clientTypes";
import Icon from "./ui/Icon";

/**
 * Watch a card from a set page. One flow covers "not tracked yet", "tracked on
 * the Cards page but not watched", and "watched, change the threshold" — the
 * server finds or creates the tracked Card and upserts its threshold.
 */
export default function SetItemWatch({ item, onChanged }: { item: SetItemDTO; onChanged: () => void }) {
  const currentThreshold = item.tracked?.thresholdCents ?? null;
  const [open, setOpen] = useState(false);
  const [threshold, setThreshold] = useState(currentThreshold != null ? (currentThreshold / 100).toFixed(2) : "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const dollars = parseFloat(threshold);
    if (!Number.isFinite(dollars) || dollars < 0) {
      setError("enter a price");
      return;
    }
    setSaving(true);
    setError(null);
    const res = await fetch(`/api/sets/items/${item.id}/watch`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ thresholdCents: Math.round(dollars * 100) }),
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
    if (!item.tracked || !confirm("Stop watching this card's price?")) return;
    await fetch(`/api/cards/watchlist/${item.tracked.cardId}`, { method: "DELETE" });
    onChanged();
  }

  if (open) {
    return (
      <form onSubmit={save} className="flex flex-wrap items-center gap-2 text-xs">
        <label className="flex items-center gap-1">
          Alert ≤ $
          <input
            type="number"
            step="0.01"
            min="0"
            required
            autoFocus
            value={threshold}
            onChange={(e) => setThreshold(e.target.value)}
            placeholder={item.marketPriceCents != null ? (item.marketPriceCents / 100).toFixed(2) : ""}
            className="input w-20 px-2 py-1 text-xs"
          />
        </label>
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
        {error && <span className="w-full text-bad">{error}</span>}
      </form>
    );
  }

  if (currentThreshold != null) {
    return (
      <div className="flex items-center gap-2 text-xs">
        <span className="chip chip-accent num">
          <Icon name="watchlist" className="h-3 w-3" /> alert ≤ ${(currentThreshold / 100).toFixed(2)}
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
    <button
      onClick={() => setOpen(true)}
      className="btn btn-sm"
    >
      + Watch
    </button>
  );
}
