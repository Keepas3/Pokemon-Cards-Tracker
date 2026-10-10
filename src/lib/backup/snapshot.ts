// A nightly copy of the whole database, kept next to it (on a host, on the same persistent volume).
// SQLite's `VACUUM INTO` writes a consistent, compacted copy while the app keeps running. The last
// few are kept, so a mistake noticed a few days later can still be undone. This guards against
// mistakes and a bad deploy; it isn't off-site, so downloading your own backup now and then
// (Settings → Your data) is still wise.

import fs from "node:fs";
import path from "node:path";
import { prisma } from "@/lib/prisma";

/** The environment variables this reads (process.env fits). */
export type Env = Record<string, string | undefined>;

export const SNAPSHOT_KEEP = 7;
/** Local hour after which the day's snapshot is taken (quiet time, and after most digests). */
export const SNAPSHOT_HOUR = 3;
const NAME = /^binder-\d{4}-\d{2}-\d{2}\.db$/;

/** The database file for a `file:` URL (relative paths are from the working directory), or null for anything else. */
export function sqlitePathFromUrl(url: string | undefined, cwd: string = process.cwd()): string | null {
  if (!url || !url.startsWith("file:")) return null;
  const raw = url.slice("file:".length).split("?")[0];
  if (!raw) return null;
  return path.isAbsolute(raw) || /^[A-Za-z]:[\\/]/.test(raw) ? path.normalize(raw) : path.resolve(cwd, raw);
}

/** Where snapshots go: BACKUP_DIR, else a "backups" folder beside the database. Null when there's no file database. */
export function backupDir(env: Env = process.env): string | null {
  if (env.BACKUP_DIR) return path.resolve(env.BACKUP_DIR);
  const db = sqlitePathFromUrl(env.DATABASE_URL ?? "file:./prisma/dev.db");
  return db ? path.join(path.dirname(db), "backups") : null;
}

const two = (n: number) => String(n).padStart(2, "0");

/** "binder-2026-10-10.db", by the local date. */
export function snapshotName(now: Date): string {
  return `binder-${now.getFullYear()}-${two(now.getMonth() + 1)}-${two(now.getDate())}.db`;
}

/** Of the snapshot files in `names`, the oldest ones beyond the newest `keep`. Anything not named like a snapshot is never touched. */
export function snapshotsToDelete(names: string[], keep: number = SNAPSHOT_KEEP): string[] {
  return names
    .filter((n) => NAME.test(n))
    .sort()
    .slice(0, Math.max(0, names.filter((n) => NAME.test(n)).length - keep));
}

export type SnapshotResult = { status: "taken"; file: string; pruned: number } | { status: "exists" | "not-due" | "no-file-db" } | { status: "error"; error: string };

/** Writes today's snapshot if it isn't there yet and it's past the snapshot hour (or `force`). */
export async function takeSnapshot(opts: { now?: Date; env?: Env; force?: boolean } = {}): Promise<SnapshotResult> {
  const now = opts.now ?? new Date();
  const dir = backupDir(opts.env);
  if (!dir) return { status: "no-file-db" };
  if (!opts.force && now.getHours() < SNAPSHOT_HOUR) return { status: "not-due" };

  const target = path.join(dir, snapshotName(now));
  try {
    fs.mkdirSync(dir, { recursive: true });
    if (fs.existsSync(target)) return { status: "exists" };
    // Written to a temporary name first, so a crash can't leave a half-written file that looks like a good snapshot.
    const partial = `${target}.partial`;
    fs.rmSync(partial, { force: true });
    await prisma.$executeRawUnsafe(`VACUUM INTO '${partial.replace(/'/g, "''")}'`);
    fs.renameSync(partial, target);

    const doomed = snapshotsToDelete(fs.readdirSync(dir));
    for (const name of doomed) fs.rmSync(path.join(dir, name), { force: true });
    return { status: "taken", file: target, pruned: doomed.length };
  } catch (err) {
    return { status: "error", error: err instanceof Error ? err.message : String(err) };
  }
}
