import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireProfile } from "@/lib/auth/current";
import { baselineSmartWatch } from "@/lib/smartWatch/service";
import { getSmartWatch, listSmartWatches } from "@/lib/smartWatch/dto";
import { parseCreate } from "@/lib/smartWatch/input";
import { describeRule } from "@/lib/smartWatch/match";

export async function GET() {
  const auth = await requireProfile();
  if (!auth.ok) return auth.response;
  return NextResponse.json({ smartWatches: await listSmartWatches(auth.profile.id) });
}

/**
 * Saves a rule. It starts quietly: whatever already matches is recorded as seen,
 * so only items that come in under the limit *afterwards* send an alert.
 */
export async function POST(req: NextRequest) {
  const auth = await requireProfile();
  if (!auth.ok) return auth.response;
  const parsed = parseCreate(await req.json().catch(() => null));
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const input = parsed.value;

  const set = await prisma.cardSet.findUnique({ where: { slug: input.setSlug } });
  if (!set) return NextResponse.json({ error: "set not found" }, { status: 404 });
  // With no saved prices there is nothing to take a baseline from, and the first
  // load would announce every match as new.
  if (!set.itemsFetchedAt) {
    return NextResponse.json(
      { error: "This set's prices haven't been loaded yet — open the set and let its prices load first." },
      { status: 409 },
    );
  }

  const watch = await prisma.smartWatch.create({
    data: {
      profileId: auth.profile.id,
      name: input.name ?? describeRule(input, set.name),
      setId: set.id,
      kind: input.kind,
      rarity: input.rarity,
      query: input.query,
      onlyMissing: input.onlyMissing ?? false,
      maxPriceCents: input.maxPriceCents,
    },
  });
  await baselineSmartWatch(watch.id);

  return NextResponse.json({ smartWatch: await getSmartWatch(auth.profile.id, watch.id) }, { status: 201 });
}
