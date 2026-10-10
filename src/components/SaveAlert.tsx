"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { SetItemDTO, SetItemKind, SmartWatchDTO } from "@/lib/clientTypes";
import { formatPrice } from "@/lib/labels";
import Icon from "./ui/Icon";
import { cardKey } from "@/lib/collection/numbers";
import { describeRule, matchItems } from "@/lib/smartWatch/match";

interface Props {
  setSlug: string;
  setName: string;
  /** The set page's current filters — the alert is "these, but only when cheap". */
  kind: SetItemKind;
  rarity: string;
  query: string;
  items: SetItemDTO[];
}

/** "Alert me when something matching what I'm looking at drops to $X" — saves a smart watch. */
export default function SaveAlert({ setSlug, setName, kind, rarity, query, items }: Props) {
  const [open, setOpen] = useState(false);
  const [dollars, setDollars] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<SmartWatchDTO | null>(null);
  const [onlyMissing, setOnlyMissing] = useState(false);

  // Sealed products have no rarity, so a leftover rarity choice must not leak into the rule.
  const effectiveRarity = kind === "CARD" && rarity ? rarity : null;
  const cents = Math.round(Number(dollars) * 100);
  const validPrice = Number.isFinite(cents) && cents > 0;

  // "Only cards I don't own" only makes sense for cards.
  const missingOnly = onlyMissing && kind === "CARD";
  const rule = useMemo(
    () => ({
      kind,
      rarity: effectiveRarity,
      query: query.trim() || null,
      maxPriceCents: validPrice ? cents : 0,
      onlyMissing: missingOnly,
    }),
    [kind, effectiveRarity, query, cents, validPrice, missingOnly],
  );
  const matchingNow = useMemo(
    () =>
      validPrice
        ? matchItems(
            rule,
            items.map((i) => ({ ...i, kind: ({ card: "CARD", sealed: "SEALED", other: "OTHER" } as const)[i.group], tcgplayerId: null })),
            { ownedKeys: new Set(items.filter((i) => i.group === "card" && i.owned > 0).map((i) => cardKey(i.number) ?? "")) },
          ).length
        : null,
    [rule, items, validPrice],
  );

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/smart-watches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          setSlug,
          kind: rule.kind,
          rarity: rule.rarity,
          query: rule.query,
          onlyMissing: rule.onlyMissing,
          maxPriceCents: cents,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "couldn't save the alert");
        return;
      }
      setSaved(json.smartWatch as SmartWatchDTO);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  if (saved) {
    return (
      <p className="flex flex-wrap items-center gap-x-1 rounded-xl border border-accent/30 bg-accent-soft px-4 py-3 text-sm text-accent-text">
        <Icon name="check" className="mr-1 h-4 w-4" /> Alert saved: {saved.name}.{" "}
        {saved.matchCount > 0
          ? `${saved.matchCount} item${saved.matchCount === 1 ? "" : "s"} already match — you won't be pinged about those, only about new ones.`
          : "Nothing matches yet — you'll get a Discord message when something does."}{" "}
        <Link href="/watchlist?tab=alerts" className="underline">
          Manage alerts
        </Link>
        {" · "}
        <button
          onClick={() => {
            setSaved(null);
            setDollars("");
          }}
          className="underline"
        >
          Add another
        </button>
      </p>
    );
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="btn">
        <Icon name="watchlist" /> Save these filters as an alert
      </button>
    );
  }

  return (
    <div className="card space-y-3 p-4">
      <p className="text-sm text-fg">
        {validPrice ? (
          <>
            Alert me on Discord when any <span className="font-medium">{describeRule(rule, setName)}</span>.
          </>
        ) : (
          <>Choose a price limit to alert on {kind === "SEALED" ? "sealed products" : "cards"} matching these filters.</>
        )}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <label className="text-sm text-muted" htmlFor="alert-price">
          At or under $
        </label>
        <input
          id="alert-price"
          type="number"
          min="0.01"
          step="0.01"
          inputMode="decimal"
          value={dollars}
          onChange={(e) => setDollars(e.target.value)}
          placeholder="25.00"
          className="input w-28"
        />
        <button
          onClick={save}
          disabled={saving || !validPrice}
          className="btn btn-primary"
        >
          {saving ? "Saving…" : "Save alert"}
        </button>
        <button onClick={() => setOpen(false)} className="btn btn-ghost">
          Cancel
        </button>
      </div>
      {kind === "CARD" && (
        <label className="flex items-center gap-2 text-sm text-muted">
          <input
            type="checkbox"
            checked={onlyMissing}
            onChange={(e) => setOnlyMissing(e.target.checked)}
            className="accent-[var(--accent)]"
          />
          Only cards I don&apos;t own yet
        </label>
      )}
      {matchingNow != null && (
        <p className="text-xs text-subtle">
          {matchingNow} item{matchingNow === 1 ? "" : "s"} match right now at {formatPrice(cents)} or less. Those won&apos;t
          trigger a message — only items that come in under the limit after you save.
        </p>
      )}
      {error && <p className="text-xs text-bad">{error}</p>}
    </div>
  );
}
