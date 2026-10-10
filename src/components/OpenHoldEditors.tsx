"use client";

import { useState } from "react";
import { formatPrice } from "@/lib/labels";
import { formatRate } from "@/lib/openOrHold/summary";
import type { Assumptions, OpenHoldDTO, RateRow, UnmodeledRarity } from "@/lib/openOrHold/types";

/** PUTs JSON; resolves to an error message, or null on success. */
async function putJson(url: string, body: unknown): Promise<string | null> {
  try {
    const res = await fetch(url, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (res.ok) return null;
    const json = await res.json().catch(() => ({}));
    return json.error ?? `request failed (${res.status})`;
  } catch (err) {
    return (err as Error).message;
  }
}

const input = "input px-2 py-1 text-sm";
const smallBtn = "btn btn-primary px-2 py-1 text-xs font-medium disabled:opacity-50";
const linkBtn = "text-xs text-subtle hover:text-fg disabled:opacity-50";

/** Fees, the bulk cut-off and bulk value — what every dollar figure on the panel rests on. */
export function AssumptionsEditor({ assumptions, onChanged }: { assumptions: Assumptions; onChanged: () => void }) {
  const [fee, setFee] = useState(String(assumptions.feePct));
  const [cutoff, setCutoff] = useState((assumptions.bulkThresholdCents / 100).toFixed(2));
  const [bulk, setBulk] = useState((assumptions.bulkPerPackCents / 100).toFixed(2));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setError(null);
    const err = await putJson("/api/open-or-hold/assumptions", {
      feePct: Number(fee),
      bulkThresholdCents: Math.round(Number(cutoff) * 100),
      bulkPerPackCents: Math.round(Number(bulk) * 100),
    });
    setBusy(false);
    if (err) setError(err);
    else onChanged();
  }

  return (
    <div className="space-y-2">
      <h4 className="text-xs font-medium text-muted">Your assumptions</h4>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="space-y-1 text-xs text-muted">
          Selling fees (%)
          <input type="number" min="0" max="50" step="0.5" value={fee} onChange={(e) => setFee(e.target.value)} className={`${input} block w-full`} />
          <span className="block text-subtle">Marketplace plus payment fees, taken off everything you&apos;d sell. 13% is an assumption — set your own.</span>
        </label>
        <label className="space-y-1 text-xs text-muted">
          Bulk cut-off ($)
          <input type="number" min="0" step="0.25" value={cutoff} onChange={(e) => setCutoff(e.target.value)} className={`${input} block w-full`} />
          <span className="block text-subtle">Cards worth less than this aren&apos;t worth listing one by one, so they count as bulk.</span>
        </label>
        <label className="space-y-1 text-xs text-muted">
          Bulk worth per pack ($)
          <input type="number" min="0" step="0.05" value={bulk} onChange={(e) => setBulk(e.target.value)} className={`${input} block w-full`} />
          <span className="block text-subtle">What the commons and bulk in one pack are worth to you. Starts at $0 — only hits are counted.</span>
        </label>
      </div>
      <div className="flex items-center gap-3">
        <button onClick={save} disabled={busy} className={smallBtn}>
          {busy ? "Saving…" : "Save assumptions"}
        </button>
        {error && <span className="text-xs text-bad">{error}</span>}
      </div>
    </div>
  );
}

/** How many packs the product holds, with the reason for the current number. */
export function PacksEditor({ dto, onChanged }: { dto: OpenHoldDTO; onChanged: () => void }) {
  const [value, setValue] = useState(dto.packs.value != null ? String(dto.packs.value) : "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send(packs: number | null) {
    setBusy(true);
    setError(null);
    const err = await putJson("/api/open-or-hold/packs", {
      setId: dto.item.setId,
      itemExternalId: dto.item.externalId,
      printing: dto.item.printing,
      packs,
    });
    setBusy(false);
    if (err) setError(err);
    else onChanged();
  }

  const n = Number(value);
  const valid = Number.isInteger(n) && n >= 1 && n <= 1000;
  return (
    <div className="space-y-1">
      <h4 className="text-xs font-medium text-muted">Packs inside</h4>
      <div className="flex flex-wrap items-center gap-2">
        <input type="number" min="1" step="1" value={value} onChange={(e) => setValue(e.target.value)} aria-label="Packs in this product" className={`${input} w-20`} />
        <button onClick={() => send(n)} disabled={busy || !valid} className={smallBtn}>
          Save
        </button>
        {dto.packs.source === "override" && (
          <button onClick={() => send(null)} disabled={busy} className={linkBtn}>
            Use {dto.packs.defaultValue != null ? `the default (${dto.packs.defaultValue})` : "no default"}
          </button>
        )}
        {error && <span className="text-xs text-bad">{error}</span>}
      </div>
      {dto.packs.note && <p className="text-xs text-subtle">{dto.packs.note}</p>}
    </div>
  );
}

function RateInput({
  row,
  setId,
  onChanged,
}: {
  row: { rarity: string; perPack: number | null; published: number | null; overridden: boolean };
  setId: number;
  onChanged: () => void;
}) {
  const [value, setValue] = useState(row.perPack != null ? String(+(row.perPack * 100).toFixed(4)) : "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send(perPack: number | null) {
    setBusy(true);
    setError(null);
    const err = await putJson("/api/open-or-hold/pull-rates", { setId, rarity: row.rarity, perPack });
    setBusy(false);
    if (err) setError(err);
    else onChanged();
  }

  const pct = Number(value);
  const valid = value.trim() !== "" && Number.isFinite(pct) && pct >= 0 && pct <= 100;
  const changed = valid && (row.perPack == null || Math.abs(pct / 100 - row.perPack) > 1e-9);

  return (
    <div className="flex flex-wrap items-center justify-end gap-1.5">
      <input
        type="number"
        min="0"
        max="100"
        step="0.01"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        aria-label={`${row.rarity} pull rate in percent`}
        className={`${input} w-20 text-right`}
      />
      <span className="text-xs text-subtle">%</span>
      {changed && (
        <button onClick={() => send(pct / 100)} disabled={busy} className={smallBtn}>
          Save
        </button>
      )}
      {row.overridden && (
        <button onClick={() => send(null)} disabled={busy} className={linkBtn} title="Go back to the published figure">
          {row.published != null ? `Reset to ${formatRate(row.published)}` : "Remove"}
        </button>
      )}
      {error && <span className="w-full text-right text-xs text-bad">{error}</span>}
    </div>
  );
}

/** Every rarity that could be a hit: its pull rate (published or yours) and a box to change it. */
export function RatesEditor({ dto, onChanged }: { dto: OpenHoldDTO; onChanged: () => void }) {
  const rows: RateRow[] = dto.rates;
  const unmodeled: UnmodeledRarity[] = dto.unmodeled;

  return (
    <div className="space-y-2">
      <h4 className="text-xs font-medium text-muted">Pull rates (chance a pack contains one)</h4>
      <p className="text-xs text-subtle">
        {dto.profile
          ? "Published figures are shown; type your own to override one. Rarities with no rate aren't counted at all."
          : "No published rates for this set. Enter the chance a pack holds each rarity you want counted — rarities left blank aren't counted."}
      </p>
      <div className="divide-y divide-line rounded border border-line">
        {rows.map((r) => (
          <div key={`${r.slot}|${r.rarity}|${r.perPack}|${r.overridden}`} className="flex flex-wrap items-center justify-between gap-2 px-2 py-1.5">
            <div className="min-w-0">
              <p className="text-xs text-fg">{r.rarity}</p>
              <p className="text-xs text-subtle">
                {r.slot} · {r.cards} card{r.cards === 1 ? "" : "s"}
                {r.avgNetCents != null && r.cards > 0 ? ` · avg ${formatPrice(Math.round(r.avgNetCents))} after fees` : ""}
                {r.poolSetName ? ` · from ${r.poolSetName}` : ""}
                {r.perPack == null ? " · no published rate" : r.overridden && r.published != null ? ` · published ${formatRate(r.published)}` : ""}
              </p>
            </div>
            <RateInput row={r} setId={dto.item.setId} onChanged={onChanged} />
          </div>
        ))}
        {unmodeled.map((u) => (
          <div key={`unmodeled|${u.rarity}|${dto.item.id}`} className="flex flex-wrap items-center justify-between gap-2 px-2 py-1.5">
            <div className="min-w-0">
              <p className="text-xs text-fg">{u.rarity}</p>
              <p className="text-xs text-subtle">
                {u.cards} card{u.cards === 1 ? "" : "s"}
                {u.maxMarketCents != null ? ` · up to ${formatPrice(Math.round(u.maxMarketCents))}` : ""} · no rate set
              </p>
            </div>
            <RateInput row={{ rarity: u.rarity, perPack: null, published: null, overridden: false }} setId={dto.item.setId} onChanged={onChanged} />
          </div>
        ))}
        {rows.length === 0 && unmodeled.length === 0 && <p className="px-2 py-2 text-xs text-subtle">No cards are loaded for this set.</p>}
      </div>
    </div>
  );
}
