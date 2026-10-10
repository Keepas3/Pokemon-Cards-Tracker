"use client";

import { formatPrice } from "@/lib/labels";
import { missingCards } from "@/lib/collection/progress";
import type { CollectionCard, SetSummary } from "@/lib/collection/progress";
import ProgressBar from "./ui/ProgressBar";

/**
 * The collection summary for a set: progress, value, cost to finish. With the
 * card list it can also show what's missing (the Collection page); without it
 * (the Browse page) it's just the summary.
 */
export default function SetCompletion({ summary: s, cards }: { summary: SetSummary; cards?: CollectionCard[] }) {
  if (s.totalCards === 0) return null;
  const complete = s.ownedCards === s.totalCards;
  const missing = cards ? missingCards(cards) : null;

  return (
    <div className="space-y-2.5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          Your collection
          {complete && <span className="chip chip-good">Complete</span>}
        </h2>
        <p className="text-xs text-muted">
          <span className="num font-semibold text-fg">{s.ownedCards}</span> of <span className="num">{s.totalCards}</span>{" "}
          cards · <span className="num">{s.percent}%</span>
          {s.copies > 0 && (
            <>
              {" · "}
              <span className="num">{s.copies}</span> {s.copies === 1 ? "copy" : "copies"} worth{" "}
              <span className="num">{formatPrice(s.valueCents)}</span>
              {s.unpricedOwned > 0 ? ` (+${s.unpricedOwned} unpriced)` : ""}
            </>
          )}
        </p>
      </div>

      <ProgressBar value={s.ownedCards} max={s.totalCards} label="Set completion" complete={complete} />

      {!complete &&
        (missing ? (
          <details className="text-xs text-muted">
            <summary className="select-none hover:text-fg">
              {missing.length} missing · <span className="num">{formatPrice(s.costToCompleteCents)}</span> to finish
              {s.unpricedMissing > 0 ? ` (${s.unpricedMissing} have no price yet)` : ""}
            </summary>
            <ul className="mt-2 max-h-72 divide-y divide-line overflow-auto rounded-lg border border-line">
              {missing.map((m) => (
                <li key={m.key} className="flex items-center justify-between gap-3 px-3 py-1.5">
                  <span className="min-w-0 truncate">
                    <span className="text-subtle">{m.setName ? `${m.setName} ${m.number}` : m.number}</span> {m.name}
                  </span>
                  <span className="num shrink-0 text-subtle">{m.priceCents != null ? formatPrice(m.priceCents) : "—"}</span>
                </li>
              ))}
            </ul>
          </details>
        ) : (
          <p className="text-xs text-subtle">
            {s.totalCards - s.ownedCards} missing · <span className="num">{formatPrice(s.costToCompleteCents)}</span> to finish
            {s.unpricedMissing > 0 ? ` (${s.unpricedMissing} have no price yet)` : ""}
          </p>
        ))}
    </div>
  );
}
