import path from "node:path";
import { describe, expect, it } from "vitest";
import { SNAPSHOT_KEEP, backupDir, snapshotName, snapshotsToDelete, sqlitePathFromUrl } from "../snapshot";

describe("sqlitePathFromUrl", () => {
  it("resolves relative paths from the working directory and keeps absolute ones", () => {
    expect(sqlitePathFromUrl("file:./prisma/dev.db", "/app")).toBe(path.resolve("/app", "prisma/dev.db"));
    expect(sqlitePathFromUrl("file:/data/app.db", "/app")).toBe(path.normalize("/data/app.db"));
    expect(sqlitePathFromUrl("file:C:/data/app.db", "/app")).toBe(path.normalize("C:/data/app.db"));
    expect(sqlitePathFromUrl("file:./x.db?connection_limit=1", "/app")).toBe(path.resolve("/app", "x.db"));
  });

  it("is null for anything that isn't a file database", () => {
    expect(sqlitePathFromUrl(undefined)).toBeNull();
    expect(sqlitePathFromUrl("postgres://u:p@host/db")).toBeNull();
    expect(sqlitePathFromUrl("file:")).toBeNull();
  });
});

describe("backupDir", () => {
  it("is BACKUP_DIR when set, else a backups folder beside the database", () => {
    expect(backupDir({ BACKUP_DIR: "/mnt/backups" })).toBe(path.resolve("/mnt/backups"));
    expect(backupDir({ DATABASE_URL: "file:/data/app.db" })).toBe(path.join(path.normalize("/data"), "backups"));
    expect(backupDir({ DATABASE_URL: "postgres://x" })).toBeNull();
  });
});

describe("snapshotName / snapshotsToDelete", () => {
  it("names a snapshot by the local date", () => {
    expect(snapshotName(new Date(2026, 9, 10, 4, 30))).toBe("binder-2026-10-10.db");
    expect(snapshotName(new Date(2027, 0, 5))).toBe("binder-2027-01-05.db");
  });

  it("keeps the newest few and only ever picks files named like snapshots", () => {
    const names = Array.from({ length: 10 }, (_, i) => `binder-2026-10-${String(i + 1).padStart(2, "0")}.db`);
    const doomed = snapshotsToDelete([...names, "notes.txt", "binder-latest.db", "binder-2026-10-03.db.partial", "dev.db"]);
    expect(doomed).toEqual(names.slice(0, 10 - SNAPSHOT_KEEP));
    expect(snapshotsToDelete(names.slice(0, 5))).toEqual([]);
    expect(snapshotsToDelete([])).toEqual([]);
  });
});
