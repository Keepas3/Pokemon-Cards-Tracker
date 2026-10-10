import type { SetItemDTO } from "@/lib/clientTypes";
import { formatPrice } from "@/lib/labels";
import { isMultiProduct } from "@/lib/openOrHold/packs";
import { safeHref } from "@/lib/security/urls";
import OpenOrHold from "./OpenOrHold";
import OwnedControl from "./OwnedControl";
import SetItemWatch from "./SetItemWatch";

interface Props {
  item: SetItemDTO;
  onChanged: () => void;
  /** Sets the total copies owned of this card printing. */
  onOwnedChange?: (item: SetItemDTO, quantity: number) => void;
}

export default function SetItemRow({ item, onChanged, onOwnedChange }: Props) {
  // "Normal" is the unremarkable default — only call out the printings that matter.
  const printing = item.printing && item.printing !== "Normal" ? item.printing : null;
  const meta = [item.number, item.rarity, printing].filter(Boolean).join(" · ");
  // Cases and displays hold several products; the calculator is for one product at a time.
  const showOpenHold = item.group === "sealed" && !isMultiProduct(item.name);

  return (
    <div className={`card p-3 transition-colors hover:border-line-strong ${item.owned > 0 ? "border-good/40" : ""}`}>
      <div className="flex flex-wrap items-center gap-3">
        {item.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.imageUrl} alt="" loading="lazy" className="h-14 w-14 shrink-0 rounded-lg bg-surface-2 object-contain" />
        ) : (
          <div className="h-14 w-14 shrink-0 rounded-lg bg-surface-2" />
        )}

        <div className="min-w-0 flex-1 basis-48">
          <a
            href={safeHref(item.tcgplayerUrl)}
            target="_blank"
            rel="noreferrer"
            title="Open on TCGplayer"
            className="block truncate text-sm font-medium hover:underline"
          >
            {item.name}
          </a>
          {meta && <div className="truncate text-xs text-subtle">{meta}</div>}
        </div>

        <div className="w-24 shrink-0 text-right">
          <div className="num text-sm font-semibold">{formatPrice(item.marketPriceCents)}</div>
          {item.lowPriceCents != null && item.lowPriceCents !== item.marketPriceCents && (
            <div className="num text-xs text-subtle">low {formatPrice(item.lowPriceCents)}</div>
          )}
        </div>

        <div className="flex min-w-[9rem] shrink-0 items-center justify-end gap-2">
          {item.group === "card" ? (
            <>
              {onOwnedChange && (
                <span title="Counts any printing of this card">
                  <OwnedControl owned={item.owned} onChange={(q) => onOwnedChange(item, q)} />
                </span>
              )}
              <SetItemWatch item={item} onChanged={onChanged} />
            </>
          ) : (
            <a
              href={safeHref(item.tcgplayerUrl)}
              target="_blank"
              rel="noreferrer"
              className="text-xs text-subtle hover:text-fg"
            >
              TCGplayer ↗
            </a>
          )}
        </div>
      </div>

      {showOpenHold && (
        <div className="mt-2">
          <OpenOrHold source={{ kind: "item", itemId: item.id }} />
        </div>
      )}
    </div>
  );
}
