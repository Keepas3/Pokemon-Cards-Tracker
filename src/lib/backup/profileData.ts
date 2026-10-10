// A person's data as a plain JSON file: what they own, the Pokémon they follow, the cards on their
// watchlist and their alert rules. It's both their backup and the way to move a collection between
// installs (e.g. from a PC to the hosted site). Pure: this file only describes and checks the format.

import { cardKey } from "@/lib/collection/numbers";
import { MAX_DEX_ID } from "@/lib/pokedex/species";
import { safeHttpUrl } from "@/lib/security/urls";

export const EXPORT_APP = "binder";
export const EXPORT_VERSION = 1;

export interface ExportedOwned {
  setId: number;
  /** For reading the file; the set is found by id. */
  setName: string;
  number: string;
  name: string;
  quantity: number;
}

export interface ExportedWatchedCard {
  provider: "TCGAPI_DEV";
  externalId: string;
  variant: string | null;
  name: string;
  setName: string;
  number: string | null;
  imageUrl: string | null;
  url: string;
  /** null = tracked with no price alert. */
  thresholdCents: number | null;
}

export interface ExportedAlertRule {
  setId: number;
  name: string;
  kind: "CARD" | "SEALED" | null;
  rarity: string | null;
  query: string | null;
  onlyMissing: boolean;
  maxPriceCents: number;
  enabled: boolean;
}

export interface ProfileExport {
  app: typeof EXPORT_APP;
  version: typeof EXPORT_VERSION;
  exportedAt: string;
  /** Who it was exported from; informational. */
  profile: string;
  owned: ExportedOwned[];
  followedPokemon: number[];
  watchedCards: ExportedWatchedCard[];
  alertRules: ExportedAlertRule[];
}

/** Generous limits, so a damaged or hostile file can't make the server do unbounded work. */
export const LIMITS = { owned: 100_000, followed: MAX_DEX_ID, watched: 5_000, rules: 500 } as const;

type Result<T> = { ok: true; value: T; skipped: string[] } | { ok: false; error: string };

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const isInt = (v: unknown, min: number, max: number): v is number => typeof v === "number" && Number.isInteger(v) && v >= min && v <= max;
const text = (v: unknown, max: number): string | null => (typeof v === "string" && v.trim() !== "" && v.length <= max ? v.trim() : null);
const optText = (v: unknown, max: number): string | null => (v == null || v === "" ? null : text(v, max));

/**
 * Reads an uploaded file. A wrong kind of file or a wrong version is refused; individual rows that
 * don't make sense are skipped (and counted) rather than failing the whole restore.
 */
export function parseImport(json: unknown): Result<ProfileExport> {
  if (!isObj(json) || json.app !== EXPORT_APP) return { ok: false, error: "That doesn't look like a backup from this app." };
  if (json.version !== EXPORT_VERSION) return { ok: false, error: `This backup is version ${String(json.version)}; this app reads version ${EXPORT_VERSION}.` };

  const lists: [string, number][] = [
    ["owned", LIMITS.owned],
    ["followedPokemon", LIMITS.followed],
    ["watchedCards", LIMITS.watched],
    ["alertRules", LIMITS.rules],
  ];
  for (const [key, max] of lists) {
    const list = json[key];
    if (list !== undefined && (!Array.isArray(list) || list.length > max)) {
      return { ok: false, error: `"${key}" must be a list of at most ${max.toLocaleString("en-US")} entries.` };
    }
  }

  const skipped: string[] = [];
  const skip = (what: string) => skipped.push(what);

  const owned: ExportedOwned[] = [];
  for (const r of (json.owned as unknown[] | undefined) ?? []) {
    if (!isObj(r)) { skip("owned: not an object"); continue; }
    const number = text(r.number, 40);
    const name = text(r.name, 200);
    if (!isInt(r.setId, 1, 2 ** 31 - 1) || !number || cardKey(number) == null || !name || !isInt(r.quantity, 1, 9999)) {
      skip(`owned: ${String(r.name ?? r.number ?? "an entry")}`);
      continue;
    }
    owned.push({ setId: r.setId, setName: text(r.setName, 200) ?? "", number, name, quantity: r.quantity });
  }

  const followedPokemon = [...new Set(((json.followedPokemon as unknown[] | undefined) ?? []).filter((d): d is number => isInt(d, 1, MAX_DEX_ID)))];

  const watchedCards: ExportedWatchedCard[] = [];
  for (const r of (json.watchedCards as unknown[] | undefined) ?? []) {
    if (!isObj(r)) { skip("watched card: not an object"); continue; }
    const url = safeHttpUrl(r.url);
    const imageUrl = r.imageUrl == null ? null : safeHttpUrl(r.imageUrl);
    const externalId = text(r.externalId, 64);
    const name = text(r.name, 200);
    const setName = text(r.setName, 200);
    // JustTCG is no longer supported; old backups may still list its cards.
    if (r.provider !== "TCGAPI_DEV" || !url || (r.imageUrl != null && !imageUrl) || !externalId || !name || !setName) {
      skip(`watched card: ${String(r.name ?? "an entry")}`);
      continue;
    }
    const threshold = r.thresholdCents == null ? null : isInt(r.thresholdCents, 0, 100_000_000) ? r.thresholdCents : undefined;
    if (threshold === undefined) { skip(`watched card: ${name} (bad price)`); continue; }
    watchedCards.push({ provider: "TCGAPI_DEV", externalId, variant: optText(r.variant, 80), name, setName, number: optText(r.number, 40), imageUrl, url, thresholdCents: threshold });
  }

  const alertRules: ExportedAlertRule[] = [];
  for (const r of (json.alertRules as unknown[] | undefined) ?? []) {
    if (!isObj(r)) { skip("alert rule: not an object"); continue; }
    const name = text(r.name, 200);
    const kind = r.kind === "CARD" || r.kind === "SEALED" ? r.kind : r.kind == null ? null : undefined;
    if (!isInt(r.setId, 1, 2 ** 31 - 1) || !name || kind === undefined || !isInt(r.maxPriceCents, 1, 100_000_000) || typeof r.onlyMissing !== "boolean" || typeof r.enabled !== "boolean") {
      skip(`alert rule: ${String(r.name ?? "an entry")}`);
      continue;
    }
    alertRules.push({ setId: r.setId, name, kind, rarity: optText(r.rarity, 80), query: optText(r.query, 120), onlyMissing: r.onlyMissing, maxPriceCents: r.maxPriceCents, enabled: r.enabled });
  }

  return {
    ok: true,
    skipped,
    value: {
      app: EXPORT_APP,
      version: EXPORT_VERSION,
      exportedAt: text(json.exportedAt, 40) ?? new Date().toISOString(),
      profile: text(json.profile, 80) ?? "",
      owned,
      followedPokemon,
      watchedCards,
      alertRules,
    },
  };
}

/** A safe file name for a download: letters, digits, dashes. */
export function exportFileName(profileName: string, now: Date = new Date()): string {
  const slug = profileName.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "profile";
  return `binder-${slug}-${now.toISOString().slice(0, 10)}.json`;
}
