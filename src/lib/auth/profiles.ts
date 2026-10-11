import { prisma } from "@/lib/prisma";
import { bootstrapProblems, parseBootstrapEntries, planBootstrap } from "./bootstrap";
import type { BootstrapEntry } from "./bootstrap";
import { hashPassword, passwordProblem, verifyPassword } from "./password";

export interface PublicProfile {
  id: string;
  name: string;
  /** False until a password has been set for it (see bootstrap.ts). */
  hasPassword: boolean;
}

/** Everyone who can be chosen on the sign-in page: names only, never hashes. */
export async function listProfiles(): Promise<PublicProfile[]> {
  const rows = await prisma.profile.findMany({ select: { id: true, name: true, passwordHash: true }, orderBy: { createdAt: "asc" } });
  return rows.map((r) => ({ id: r.id, name: r.name, hasPassword: r.passwordHash !== "" }));
}

/**
 * Applies BOOTSTRAP_PROFILES-style entries (see planBootstrap for the rules). Returns what it
 * did, in words, never with a password in it.
 */
export async function applyBootstrap(entries: BootstrapEntry[], opts: { overwrite?: boolean } = {}): Promise<string[]> {
  if (entries.length === 0) return [];
  const existing = (await prisma.profile.findMany({ select: { id: true, name: true, passwordHash: true } })).map((p) => ({
    id: p.id,
    name: p.name,
    hasPassword: p.passwordHash !== "",
  }));

  const log: string[] = [];
  for (const action of planBootstrap(existing, entries, opts)) {
    const passwordHash = await hashPassword(action.password);
    if (action.type === "create") {
      await prisma.profile.create({ data: { name: action.name, passwordHash } });
      log.push(`created profile "${action.name}"`);
    } else if (action.type === "claim") {
      await prisma.profile.update({ where: { id: action.profileId }, data: { name: action.name, passwordHash } });
      log.push(`profile "${action.name}" now owns the existing data`);
    } else {
      await prisma.profile.update({ where: { id: action.profileId }, data: { passwordHash } });
      log.push(`set the password for "${action.name}"`);
    }
  }
  return log;
}

/**
 * Runs once at startup: creates or claims the profiles named in BOOTSTRAP_PROFILES. Safe to run every
 * time, because it never replaces an existing password — unless BOOTSTRAP_OVERWRITE=1, which is the
 * deliberate way to reset a forgotten password on a host with no shell: put the new password in
 * BOOTSTRAP_PROFILES, set the flag for one deploy, then remove it.
 */
export async function bootstrapFromEnv(env: Record<string, string | undefined> = process.env): Promise<void> {
  const entries = parseBootstrapEntries(env.BOOTSTRAP_PROFILES);
  if (!env.BOOTSTRAP_PROFILES?.trim()) {
    console.warn("[auth] BOOTSTRAP_PROFILES is not set (or is empty), so no profiles are created. Set it on this service and redeploy: Name:password,Name2:password2");
    return;
  }
  for (const problem of bootstrapProblems(env.BOOTSTRAP_PROFILES)) console.warn(`[auth] BOOTSTRAP_PROFILES: ${problem}`);
  if (entries.length === 0) {
    console.warn("[auth] BOOTSTRAP_PROFILES is set but has no usable entries (each needs a name and a password of 8+ characters).");
    return;
  }
  const overwrite = env.BOOTSTRAP_OVERWRITE === "1";
  if (overwrite) console.warn("[auth] BOOTSTRAP_OVERWRITE=1: passwords in BOOTSTRAP_PROFILES replace the saved ones. Remove the flag after this deploy.");
  for (const line of await applyBootstrap(entries, { overwrite })) console.log(`[auth] ${line}`);
}

export type ChangePasswordResult = "ok" | "wrong-password" | "weak" | "no-profile";

/** Changes a profile's own password; the current one must be right. */
export async function changePassword(profileId: string, current: string, next: string): Promise<{ result: ChangePasswordResult; problem?: string }> {
  const profile = await prisma.profile.findUnique({ where: { id: profileId } });
  if (!profile) return { result: "no-profile" };
  if (!(await verifyPassword(current, profile.passwordHash))) return { result: "wrong-password" };
  const problem = passwordProblem(next);
  if (problem) return { result: "weak", problem };
  await prisma.profile.update({ where: { id: profileId }, data: { passwordHash: await hashPassword(next) } });
  return { result: "ok" };
}
