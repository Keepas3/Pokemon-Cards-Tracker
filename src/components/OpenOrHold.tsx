"use client";

import { useState } from "react";
import Link from "next/link";
import { formatDate, formatPrice, timeAgo } from "@/lib/labels";
import { describeResult, formatProb, formatRate, verdictBlurbs, verdictLabels } from "@/lib/openOrHold/summary";
import type { OpenHoldDTO, Verdict } from "@/lib/openOrHold/types";
import { useApi } from "@/lib/useApi";
import { AssumptionsEditor, PacksEditor, RatesEditor } from "./OpenHoldEditors";
import Icon from "./ui/Icon";
import Stat from "./ui/Stat";

type Source = { kind: "item"; itemId: string };

const verdictStyle: Record<Verdict, string> = {
  hold: "border-warn/30 bg-warn-soft text-warn",
  open: "border-good/30 bg-good-soft text-good",
  "toss-up": "border-accent/30 bg-accent-soft text-accent-text",
};

const usd = (cents: number | null | undefined) => formatPrice(cents == null ? null : Math.round(cents));

function AnalysisView({ dto, onChanged }: { dto: OpenHoldDTO; onChanged: () => void }) {
  const r = dto.result;
  const published = dto.profile != null && !dto.rates.some((x) => x.overridden);
  const notCounted = [
    ...dto.rates
      .filter((x) => x.perPack == null && x.cards > 0)
      .map((x) => `${x.rarity} (${x.cards} card${x.cards === 1 ? "" : "s"}, up to ${usd(x.maxMarketCents)}) — no published rate`),
    ...dto.unmodeled
      .filter((u) => (u.maxMarketCents ?? 0) >= dto.assumptions.bulkThresholdCents)
      .map((u) => `${u.rarity} (${u.cards} card${u.cards === 1 ? "" : "s"}, up to ${usd(u.maxMarketCents)}) — no rate set`),
  ];

  return (
    <div className="space-y-4">
      {dto.blockers.length > 0 && (
        <div className="space-y-1 rounded-lg border border-warn/30 bg-warn-soft px-3 py-2 text-xs text-warn">
          {dto.blockers.map((b) => (
            <p key={b}>{b}</p>
          ))}
        </div>
      )}

      {r && (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat
              label="Hold: sealed is worth"
              value={r.sealedNetCents != null ? usd(r.sealedNetCents) : "—"}
              hint={dto.sealedPriceCents != null ? `market ${formatPrice(dto.sealedPriceCents)} less fees` : "no market price"}
            />
            <Stat
              label="Open: worth on average"
              value={usd(r.evCents)}
              hint={`8 in 10 land between ${usd(r.spread.p10)} and ${usd(r.spread.p90)}`}
            />
            <Stat label="Chance opening wins" value={formatProb(r.probBeatsSealed)} hint="opened returns more than sealed" />
            {r.verdict ? (
              <div className={`rounded-lg border p-3 ${verdictStyle[r.verdict]}`}>
                <p className="text-xs opacity-80">On these assumptions</p>
                <p className="mt-0.5 text-lg font-semibold">{verdictLabels[r.verdict]}</p>
                <p className="mt-0.5 text-xs opacity-80">{verdictBlurbs[r.verdict]}</p>
              </div>
            ) : (
              <Stat label="Verdict" value="—" hint="needs a sealed market price" />
            )}
          </div>

          <ul className="space-y-1 text-sm text-muted">
            {describeResult(r, {
              sealedPriceCents: dto.sealedPriceCents,
              retailPriceCents: dto.retailPriceCents,
              published,
            }).map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>

          <div className="space-y-1.5">
            <h4 className="text-xs font-medium text-muted">Where the opened value comes from</h4>
            <div className="divide-y divide-line rounded border border-line text-xs">
              {r.byRarity.map((b) => (
                <div key={b.rarity} className="flex items-center justify-between gap-3 px-2 py-1.5">
                  <span className="min-w-0 truncate text-fg">{b.rarity}</span>
                  <span className="shrink-0 text-subtle">
                    {formatRate(b.perPack)} of packs · {b.cards} card{b.cards === 1 ? "" : "s"} · avg {usd(b.avgNetCents)}
                  </span>
                  <span className="w-20 shrink-0 text-right font-medium text-fg">{usd(b.evCents)}</span>
                </div>
              ))}
              {r.bulkEvCents > 0 && (
                <div className="flex items-center justify-between px-2 py-1.5">
                  <span className="text-fg">Bulk</span>
                  <span className="w-20 text-right font-medium text-fg">{usd(r.bulkEvCents)}</span>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <h4 className="text-xs font-medium text-muted">If the hit rates are off</h4>
            <div className="grid gap-2 sm:grid-cols-3">
              {r.sensitivity.map((s) => (
                <div key={s.scale} className="rounded border border-line px-2 py-1.5 text-xs text-muted">
                  <p className="text-fg">
                    {s.scale === 1 ? "As used" : s.scale < 1 ? `${Math.round((1 - s.scale) * 100)}% lower` : `${Math.round((s.scale - 1) * 100)}% higher`}
                  </p>
                  <p>
                    {usd(s.evCents)} on average · {formatProb(s.probBeatsSealed)} win
                  </p>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {(notCounted.length > 0 || r) && (
        <div className="space-y-1 rounded-lg border border-line px-3 py-2 text-xs text-subtle">
          <p className="font-medium text-muted">Not counted</p>
          <ul className="list-disc space-y-0.5 pl-4">
            {notCounted.map((n) => (
              <li key={n}>{n}</li>
            ))}
            <li>Promo cards, sleeves, dice and other extras that come in boxes are not valued — only the booster packs.</li>
            <li>
              Bulk: cards under {formatPrice(dto.assumptions.bulkThresholdCents)} are valued at $0
              {dto.assumptions.bulkPerPackCents > 0 ? `, plus ${formatPrice(dto.assumptions.bulkPerPackCents)} of bulk per pack` : ""}. Selling costs beyond the fee (shipping, time) aren&apos;t included.
            </li>
          </ul>
        </div>
      )}

      {dto.warnings.length > 0 && (
        <div className="space-y-1 card px-3 py-2 text-xs text-muted">
          {dto.warnings.map((w) => (
            <p key={w} className="flex gap-1.5">
              <Icon name="alert" className="mt-0.5 h-3.5 w-3.5 text-warn" />
              {w}
            </p>
          ))}
        </div>
      )}

      <details className="card p-3">
        <summary className="cursor-pointer text-xs font-medium text-muted">Assumptions, sources &amp; editing</summary>
        <div className="mt-3 space-y-4">
          {dto.profile ? (
            <div className="space-y-1 text-xs text-subtle">
              <p>
                Pull rates:{" "}
                <a href={dto.profile.url} target="_blank" rel="noreferrer" className="text-muted underline">
                  {dto.profile.title}
                </a>{" "}
                (TCGplayer, {formatDate(dto.profile.published)}, {dto.profile.packsOpened} packs opened).
              </p>
              <ul className="list-disc space-y-0.5 pl-4 text-subtle">
                {dto.profile.notes.map((n) => (
                  <li key={n}>{n}</li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="text-xs text-subtle">No published pull rates for {dto.item.setName} — the rates below are yours.</p>
          )}
          <p className="text-xs text-subtle">
            Card prices {dto.pricesFetchedAt ? `from ${timeAgo(dto.pricesFetchedAt)}` : "not loaded"} (TCGplayer market price, via{" "}
            <Link href={`/browse/sets/${dto.item.setSlug}`} className="underline">
              {dto.item.setName}
            </Link>
            ).
          </p>
          <PacksEditor key={`packs|${dto.packs.value}|${dto.packs.source}`} dto={dto} onChanged={onChanged} />
          <AssumptionsEditor
            key={`a|${dto.assumptions.feePct}|${dto.assumptions.bulkThresholdCents}|${dto.assumptions.bulkPerPackCents}`}
            assumptions={dto.assumptions}
            onChanged={onChanged}
          />
          <RatesEditor dto={dto} onChanged={onChanged} />
        </div>
      </details>
    </div>
  );
}

function ItemPanel({ itemId }: { itemId: string }) {
  const { data, error, loading, reload } = useApi<OpenHoldDTO>(`/api/open-or-hold/items/${encodeURIComponent(itemId)}`);
  if (loading && !data) return <p className="text-xs text-subtle">Working it out…</p>;
  if (!data) return <p className="text-xs text-warn">{error ?? "Couldn't analyse this product."}</p>;
  return <AnalysisView dto={data} onChanged={reload} />;
}

/**
 * "Open or hold?" for one sealed product: what it's worth sealed, what opening
 * it is worth on average and how often that beats holding. Collapsed until
 * asked for, so listing hundreds of products costs nothing.
 */
export default function OpenOrHold({ source }: { source: Source }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="w-full">
      <button onClick={() => setOpen((o) => !o)} aria-expanded={open} className="btn btn-sm">
        <Icon name="scale" className="h-3.5 w-3.5" /> Open or hold?
        <Icon name="chevron" className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="mt-2 rounded-xl border border-line bg-bg p-4">
          <ItemPanel itemId={source.itemId} />
        </div>
      )}
    </div>
  );
}
