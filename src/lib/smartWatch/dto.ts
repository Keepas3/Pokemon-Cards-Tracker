import { prisma } from "@/lib/prisma";
import type { SmartWatchDTO } from "@/lib/clientTypes";

const include = { set: true, _count: { select: { matches: true } } } as const;

type WatchRow = Awaited<ReturnType<typeof loadRows>>[number];

function loadRows(where: { profileId: string; id?: string }) {
  return prisma.smartWatch.findMany({ where, include, orderBy: { createdAt: "desc" } });
}

function toDTO(w: WatchRow): SmartWatchDTO {
  return {
    id: w.id,
    name: w.name,
    setId: w.setId,
    setName: w.set.name,
    setSlug: w.set.slug,
    kind: w.kind,
    rarity: w.rarity,
    query: w.query,
    onlyMissing: w.onlyMissing,
    maxPriceCents: w.maxPriceCents,
    enabled: w.enabled,
    // Saved matches are only kept up to date while a rule is on.
    matchCount: w.enabled ? w._count.matches : 0,
    setItemsFetchedAt: w.set.itemsFetchedAt?.toISOString() ?? null,
  };
}

/** One person's alert rules. */
export async function listSmartWatches(profileId: string): Promise<SmartWatchDTO[]> {
  return (await loadRows({ profileId })).map(toDTO);
}

export async function getSmartWatch(profileId: string, id: string): Promise<SmartWatchDTO | null> {
  const [row] = await loadRows({ profileId, id });
  return row ? toDTO(row) : null;
}
