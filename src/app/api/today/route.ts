import { NextResponse } from "next/server";
import { requireProfile } from "@/lib/auth/current";
import { buildDigest } from "@/lib/digest/build";
import { listSmartWatches } from "@/lib/smartWatch/dto";
import { loadDeals } from "@/lib/deals/service";
import { budgetDTO } from "@/lib/sets/setsService";
import type { TodayPayload } from "@/lib/clientTypes";

const DAY_MS = 24 * 60 * 60 * 1000;

/** The Today page: the last 24 hours as the signed-in person's morning digest would report them, plus the state around it. */
export async function GET() {
  const auth = await requireProfile();
  if (!auth.ok) return auth.response;
  const { profile } = auth;

  const now = new Date();
  const [digest, smartWatches, deals] = await Promise.all([
    buildDigest(profile.id, new Date(now.getTime() - DAY_MS), now),
    listSmartWatches(profile.id),
    loadDeals(profile.id, { scope: "mine", limit: 6 }),
  ]);

  const payload: TodayPayload = {
    digest,
    deals: deals.deals,
    dealsFound: deals.found,
    smartWatches,
    digestEnabled: profile.digestEnabled,
    digestHour: profile.digestHour,
    lastDigestAt: profile.lastDigestAt?.toISOString() ?? null,
    hasWebhook: Boolean(profile.notificationsEnabled && profile.discordWebhookUrl),
    budget: budgetDTO(),
  };
  return NextResponse.json(payload);
}
