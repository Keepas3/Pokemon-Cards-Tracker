// How profiles get their first passwords without a "first visitor claims it" hole: the
// owner of the deployment lists them in BOOTSTRAP_PROFILES (or runs `npm run profile:set`),
// and the app applies that at startup. This file is the pure planning half.

import { passwordProblem } from "./password";

export interface BootstrapEntry {
  name: string;
  password: string;
}

export const MAX_NAME_LENGTH = 40;

const hasControlCharacter = (text: string) => [...text].some((ch) => ch.codePointAt(0)! < 32 || ch.codePointAt(0) === 127);

/** A profile's display name, trimmed, or null if it isn't acceptable. */
export function cleanName(name: unknown): string | null {
  if (typeof name !== "string") return null;
  // Check the raw text first: collapsing whitespace would turn a newline into a harmless-looking space.
  if (hasControlCharacter(name.trim())) return null;
  const cleaned = name.trim().replace(/ {2,}/g, " ");
  return cleaned.length === 0 || cleaned.length > MAX_NAME_LENGTH ? null : cleaned;
}

/**
 * BOOTSTRAP_PROFILES, as either JSON — [{"name":"Sam","password":"…"}] — or the short form
 * "Sam:password,Alex:password" (split on the first colon, so a password may contain colons
 * but not commas; use JSON for those). Entries that are malformed are dropped.
 */
export function parseBootstrapEntries(value: string | undefined | null): BootstrapEntry[] {
  const text = value?.trim();
  if (!text) return [];

  let raw: { name?: unknown; password?: unknown }[] = [];
  if (text.startsWith("[")) {
    try {
      const parsed: unknown = JSON.parse(text);
      raw = Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  } else {
    raw = text.split(",").map((pair) => {
      const i = pair.indexOf(":");
      return i < 0 ? {} : { name: pair.slice(0, i), password: pair.slice(i + 1) };
    });
  }

  const seen = new Set<string>();
  const out: BootstrapEntry[] = [];
  for (const entry of raw) {
    const name = cleanName(entry?.name);
    if (!name || passwordProblem(entry?.password) || seen.has(name.toLowerCase())) continue;
    seen.add(name.toLowerCase());
    out.push({ name, password: entry.password as string });
  }
  return out;
}

/**
 * Why entries in BOOTSTRAP_PROFILES were left out, for the startup log: one line per dropped entry, saying
 * which one (by position and name) and what is wrong. Never contains a password.
 */
export function bootstrapProblems(value: string | undefined | null): string[] {
  const text = value?.trim();
  if (!text) return [];
  if (text.startsWith("[")) {
    try {
      if (!Array.isArray(JSON.parse(text))) return ["it starts with [ but isn't a JSON list"];
    } catch {
      return ["it starts with [ but isn't valid JSON; for the short form write Name:password,Name2:password2"];
    }
  }
  const raw: { name?: unknown; password?: unknown; colonMissing?: boolean }[] = text.startsWith("[")
    ? JSON.parse(text)
    : text.split(",").map((pair) => {
        const i = pair.indexOf(":");
        // No name is kept for a piece without a colon: it may be the tail of a password that contained a comma.
        return i < 0 ? { colonMissing: true } : { name: pair.slice(0, i), password: pair.slice(i + 1) };
      });
  const problems: string[] = [];
  const seen = new Set<string>();
  raw.forEach((entry, i) => {
    const label = `entry ${i + 1}${typeof entry?.name === "string" && entry.name.trim() ? ` ("${entry.name.trim().slice(0, 20)}")` : ""}`;
    const name = cleanName(entry?.name);
    if (entry?.colonMissing) problems.push(`${label}: no ":" between a name and a password (a comma inside a password also splits it; use the JSON form for those)`);
    else if (!name) problems.push(`${label}: no usable name`);
    else if (passwordProblem(entry.password)) problems.push(`${label}: ${passwordProblem(entry.password)}`);
    else if (seen.has(name.toLowerCase())) problems.push(`${label}: the same name is listed twice`);
    else seen.add(name.toLowerCase());
  });
  return problems;
}

export interface ExistingProfile {
  id: string;
  name: string;
  hasPassword: boolean;
}

export type BootstrapAction =
  /** A profile with this name exists and has no password yet. */
  | { type: "set-password"; profileId: string; name: string; password: string }
  /** A profile with no password (the one the old single-user data was moved onto) takes this name. */
  | { type: "claim"; profileId: string; name: string; password: string }
  | { type: "create"; name: string; password: string };

/**
 * What to do for each entry, in order:
 *  1. a profile already named that → give it the password if it has none (never replace an
 *     existing password from the environment, so editing the variable can't reset someone's login;
 *     `overwrite` is only for the deliberate command-line reset);
 *  2. otherwise the first profile that has no password yet is renamed and given it — that is how
 *     your existing collection becomes yours;
 *  3. otherwise a new profile is created.
 */
export function planBootstrap(
  existing: ExistingProfile[],
  entries: BootstrapEntry[],
  opts: { overwrite?: boolean } = {},
): BootstrapAction[] {
  const actions: BootstrapAction[] = [];
  const taken = new Set<string>();
  const byName = new Map(existing.map((p) => [p.name.toLowerCase(), p]));

  for (const entry of entries) {
    const same = byName.get(entry.name.toLowerCase());
    if (same) {
      if (!same.hasPassword || opts.overwrite) {
        actions.push({ type: "set-password", profileId: same.id, name: same.name, password: entry.password });
      }
      taken.add(same.id);
      continue;
    }
    const unclaimed = existing.find((p) => !p.hasPassword && !taken.has(p.id));
    if (unclaimed) {
      taken.add(unclaimed.id);
      actions.push({ type: "claim", profileId: unclaimed.id, name: entry.name, password: entry.password });
      continue;
    }
    actions.push({ type: "create", name: entry.name, password: entry.password });
  }
  return actions;
}
