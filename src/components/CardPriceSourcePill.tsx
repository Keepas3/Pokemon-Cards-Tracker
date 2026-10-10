import { cardPriceProviderLabels, formatPrice, timeAgo } from "@/lib/labels";
import type { CardPriceSourceDTO } from "@/lib/clientTypes";
import { safeHref } from "@/lib/security/urls";

export default function CardPriceSourcePill({
  source,
  onDelete,
}: {
  source: CardPriceSourceDTO;
  onDelete: () => void;
}) {
  const state: "priced" | "error" | "unchecked" = source.lastError
    ? "error"
    : source.lastCheckedAt == null
      ? "unchecked"
      : "priced";

  const styles: Record<typeof state, string> = {
    priced: "border-line bg-surface-2 text-fg",
    error: "border-warn/30 bg-warn-soft text-warn",
    unchecked: "border-line bg-surface-2 text-subtle",
  };

  return (
    <div className={`flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm ${styles[state]}`}>
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium">{cardPriceProviderLabels[source.provider]}</span>
          {source.variant && <span className="text-subtle">· {source.variant}</span>}
          {state === "priced" && (
            <span>
              {formatPrice(source.lastPriceCents)}
              {source.lastLowPriceCents != null && source.lastLowPriceCents !== source.lastPriceCents && (
                <span className="text-subtle"> (low {formatPrice(source.lastLowPriceCents)})</span>
              )}
            </span>
          )}
          {state === "unchecked" && <span>Not checked yet</span>}
        </div>
        {source.lastError ? (
          <div className="mt-0.5 truncate text-xs text-warn" title={source.lastError}>
            {source.lastError}
          </div>
        ) : (
          <div className="mt-0.5 text-xs text-subtle">checked {timeAgo(source.lastCheckedAt)}</div>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <a href={safeHref(source.url)} target="_blank" rel="noreferrer" className="text-xs text-subtle hover:text-fg">
          view
        </a>
        <button onClick={onDelete} className="text-xs text-subtle hover:text-bad">
          remove
        </button>
      </div>
    </div>
  );
}
