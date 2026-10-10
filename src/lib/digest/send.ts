import { prisma } from "@/lib/prisma";
import { postDiscord } from "@/lib/notify/discord";
import { allowedWebhook } from "@/lib/notify/config";
import { buildDigest } from "./build";
import { formatDigest } from "./format";
import { digestDue } from "./pure";
import { markDealsNoticed } from "@/lib/deals/service";

const DAY_MS = 24 * 60 * 60 * 1000;

export type SendDigestResult =
  | { status: "sent"; sections: number }
  | { status: "nothing" } // nothing to report today
  | { status: "no-webhook" } // notifications off, or no webhook configured
  | { status: "error"; error: string };

/**
 * Builds and sends one person's digest. A real send covers everything since their last one
 * (at most two days back, so an app that was off for a week doesn't try to summarise a week);
 * a `test` send covers the last 24 hours and doesn't touch the "already sent today" marker.
 */
export async function sendDigest(profileId: string, opts: { test?: boolean; now?: Date } = {}): Promise<SendDigestResult> {
  const now = opts.now ?? new Date();
  const webhook = await allowedWebhook(profileId, { ignoreQuietHours: true });
  if (!webhook) return { status: "no-webhook" };

  const profile = await prisma.profile.findUnique({ where: { id: profileId } });
  const since =
    opts.test || !profile?.lastDigestAt
      ? new Date(now.getTime() - DAY_MS)
      : new Date(Math.max(profile.lastDigestAt.getTime(), now.getTime() - 2 * DAY_MS));

  const digest = await buildDigest(profileId, since, now, { deals: true });
  const payload = formatDigest(digest);

  if (!payload) {
    if (!opts.test) await markSent(profileId, now); // don't rebuild an empty digest every minute
    return { status: "nothing" };
  }

  const result = await postDiscord(webhook, payload);
  if (!result.ok) return { status: "error", error: result.error ?? "Discord rejected the message" };

  if (!opts.test) {
    await markSent(profileId, now);
    // Only a real send counts as having told them, so a test digest doesn't use up tomorrow's news.
    await markDealsNoticed(profileId, digest.deals, now);
  }
  return { status: "sent", sections: payload.embeds?.length ?? 0 };
}

async function markSent(profileId: string, now: Date) {
  await prisma.profile.update({ where: { id: profileId }, data: { lastDigestAt: now } });
}

/**
 * The scheduler's once-a-minute check: sends every person's digest that's due. Attempts are
 * spaced out per person so a broken webhook isn't retried every minute.
 */
const g = globalThis as unknown as { __lastDigestAttempt?: Map<string, number> };
const RETRY_AFTER_MS = 30 * 60 * 1000;

export async function digestTick(now: Date = new Date()): Promise<{ name: string; result: SendDigestResult }[]> {
  const attempts = (g.__lastDigestAttempt ??= new Map());
  const profiles = await prisma.profile.findMany({ where: { digestEnabled: true, passwordHash: { not: "" } } });
  const out: { name: string; result: SendDigestResult }[] = [];

  for (const profile of profiles) {
    if (!digestDue(profile, now)) continue;
    const last = attempts.get(profile.id);
    if (last && now.getTime() - last < RETRY_AFTER_MS) continue;
    attempts.set(profile.id, now.getTime());
    out.push({ name: profile.name, result: await sendDigest(profile.id, { now }) });
  }
  return out;
}
