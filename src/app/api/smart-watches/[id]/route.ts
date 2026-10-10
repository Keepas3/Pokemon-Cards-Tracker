import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireProfile } from "@/lib/auth/current";
import { baselineSmartWatch } from "@/lib/smartWatch/service";
import { getSmartWatch } from "@/lib/smartWatch/dto";
import { ONLY_MISSING_NEEDS_CARDS, parsePatch } from "@/lib/smartWatch/input";
import { describeRule } from "@/lib/smartWatch/match";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Edits a rule. Changing what it matches, or switching it back on after a
 * pause, re-takes the quiet baseline — otherwise everything that moved while it
 * wasn't watching would arrive as a burst of "new" alerts.
 */
export async function PATCH(req: NextRequest, { params }: Ctx) {
  const auth = await requireProfile();
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const parsed = parsePatch(await req.json().catch(() => null));
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const { criteria, name, enabled } = parsed.value;

  // Only the owner's own rules: another profile's id looks exactly like a missing one.
  const existing = await prisma.smartWatch.findFirst({ where: { id, profileId: auth.profile.id }, include: { set: true } });
  if (!existing) return NextResponse.json({ error: "smart alert not found" }, { status: 404 });

  const next = {
    kind: criteria.kind !== undefined ? criteria.kind : existing.kind,
    rarity: criteria.rarity !== undefined ? criteria.rarity : existing.rarity,
    query: criteria.query !== undefined ? criteria.query : existing.query,
    maxPriceCents: criteria.maxPriceCents ?? existing.maxPriceCents,
    onlyMissing: criteria.onlyMissing ?? existing.onlyMissing,
  };
  if (next.onlyMissing) {
    if (next.kind === "SEALED") return NextResponse.json({ error: ONLY_MISSING_NEEDS_CARDS }, { status: 400 });
    next.kind = "CARD"; // only cards can be missing
  }
  const criteriaChanged =
    next.kind !== existing.kind ||
    next.rarity !== existing.rarity ||
    next.query !== existing.query ||
    next.maxPriceCents !== existing.maxPriceCents ||
    next.onlyMissing !== existing.onlyMissing;
  const turnedOn = enabled === true && !existing.enabled;

  // A name we generated follows the rule; one the user typed is left alone.
  const wasGenerated = existing.name === describeRule(existing, existing.set.name);
  let nextName = existing.name;
  if (name !== undefined) nextName = name ?? describeRule(next, existing.set.name);
  else if (criteriaChanged && wasGenerated) nextName = describeRule(next, existing.set.name);

  await prisma.smartWatch.update({
    where: { id },
    data: { ...next, name: nextName, ...(enabled !== undefined ? { enabled } : {}) },
  });
  if (criteriaChanged || turnedOn) await baselineSmartWatch(id);

  return NextResponse.json({ smartWatch: await getSmartWatch(auth.profile.id, id) });
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const auth = await requireProfile();
  if (!auth.ok) return auth.response;
  const { id } = await params;
  // Matches go with it (cascade).
  const result = await prisma.smartWatch.deleteMany({ where: { id, profileId: auth.profile.id } });
  if (result.count === 0) return NextResponse.json({ error: "smart alert not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
