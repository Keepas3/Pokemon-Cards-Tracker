"use client";

import { useState } from "react";
import Link from "next/link";
import type { SmartWatchDTO } from "@/lib/clientTypes";
import { formatPrice, timeAgo } from "@/lib/labels";
import EmptyState from "./ui/EmptyState";

function AlertRow({ watch, onChanged }: { watch: SmartWatchDTO; onChanged: () => void }) {
  const [editing, setEditing] = useState(false);
  const [dollars, setDollars] = useState((watch.maxPriceCents / 100).toFixed(2));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send(method: "PATCH" | "DELETE", body?: object) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/smart-watches/${watch.id}`, {
        method,
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        setError(json.error ?? "that didn't work");
        return false;
      }
      onChanged();
      return true;
    } catch (err) {
      setError((err as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function savePrice() {
    const cents = Math.round(Number(dollars) * 100);
    if (!Number.isFinite(cents) || cents <= 0) {
      setError("Enter a price above $0");
      return;
    }
    if (await send("PATCH", { maxPriceCents: cents })) setEditing(false);
  }

  return (
    <div className={`card p-4 ${watch.enabled ? "" : "opacity-60"}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium leading-snug">{watch.name}</p>
          <p className="mt-0.5 text-xs text-subtle">
            <Link href={`/browse/sets/${watch.setSlug}`} className="hover:text-fg hover:underline">
              {watch.setName}
            </Link>
            {" · "}
            {watch.enabled ? (
              <>
                <span className="num">{watch.matchCount}</span> matching now · prices{" "}
                {watch.setItemsFetchedAt ? `checked ${timeAgo(watch.setItemsFetchedAt)}` : "not loaded"}
              </>
            ) : (
              "paused"
            )}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          {editing ? (
            <>
              <span className="text-xs text-subtle">$</span>
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={dollars}
                onChange={(e) => setDollars(e.target.value)}
                aria-label="Price limit in dollars"
                className="input w-24"
              />
              <button onClick={savePrice} disabled={busy} className="btn btn-primary btn-sm">
                Save
              </button>
              <button onClick={() => setEditing(false)} className="btn btn-ghost btn-sm">
                Cancel
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => {
                  setDollars((watch.maxPriceCents / 100).toFixed(2));
                  setEditing(true);
                }}
                title="Change the price limit"
                className="chip chip-accent num cursor-pointer hover:brightness-110"
              >
                ≤ {formatPrice(watch.maxPriceCents)}
              </button>
              <button onClick={() => send("PATCH", { enabled: !watch.enabled })} disabled={busy} className="btn btn-ghost btn-sm">
                {watch.enabled ? "Pause" : "Resume"}
              </button>
              <button
                onClick={() => {
                  if (confirm(`Delete the alert “${watch.name}”?`)) void send("DELETE");
                }}
                disabled={busy}
                className="btn btn-ghost btn-sm hover:text-bad"
              >
                Delete
              </button>
            </>
          )}
        </div>
      </div>
      {error && <p className="mt-2 text-xs text-bad">{error}</p>}
    </div>
  );
}

/** The watchlist's rules: "tell me when anything like this drops to $X". */
export default function SmartAlerts({
  alerts,
  onChanged,
}: {
  alerts: SmartWatchDTO[] | null;
  onChanged: () => void;
}) {
  if (alerts == null) return <p className="text-sm text-muted">Loading…</p>;

  return (
    <div className="space-y-4">
      <p className="max-w-2xl text-sm text-muted">
        Rules on a whole set — e.g. any Special Illustration Rare under $40. Create one from a set page with &ldquo;Save
        these filters as an alert&rdquo;; you&apos;re pinged only about items that come in under the limit after you save it.
      </p>
      {alerts.length === 0 ? (
        <EmptyState title="No smart alerts yet.">
          Open a set on{" "}
          <Link href="/browse" className="link">
            Browse
          </Link>
          , filter to what you want, and save the filters as an alert.
        </EmptyState>
      ) : (
        <div className="space-y-3">
          {alerts.map((w) => (
            <AlertRow key={w.id} watch={w} onChanged={onChanged} />
          ))}
        </div>
      )}
    </div>
  );
}
