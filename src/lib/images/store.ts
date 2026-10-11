// Saved copies of set logos and icons, kept in the database so they never depend on the original
// host again. Fetched once (on first use, or ahead of time by warmImages), then served from here.

import { prisma } from "@/lib/prisma";
import { MAX_IMAGE_BYTES, sniffImageType, storableImageUrl } from "./rules";

const TIMEOUT_MS = 10_000;
/// A ceiling so nothing can fill the volume: a few hundred logos and icons are expected.
const MAX_STORED = 3000;
const RETRY_AFTER_MS = 10 * 60 * 1000;

// Addresses that recently failed, so a missing file isn't re-requested on every page view.
const failures = globalThis as unknown as { __imageFailures?: Map<string, number> };
const failedAt = () => (failures.__imageFailures ??= new Map<string, number>());

export interface Image {
  contentType: string;
  data: Uint8Array;
}

/** A saved copy, if there is one. */
export async function readStoredImage(url: string): Promise<Image | null> {
  const row = await prisma.storedImage.findUnique({ where: { sourceUrl: url } });
  return row ? { contentType: row.contentType, data: row.data } : null;
}

/** Downloads one image from an allowed host and saves it. Returns it, or null if it couldn't be fetched or isn't a real image. */
export async function fetchAndStoreImage(rawUrl: string): Promise<Image | null> {
  const url = storableImageUrl(rawUrl);
  if (!url) return null;
  const last = failedAt().get(url);
  if (last && Date.now() - last < RETRY_AFTER_MS) return null;

  try {
    // redirect: "error" — an allowed host must not be able to bounce us to somewhere else.
    const res = await fetch(url, { redirect: "error", signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (!res.ok) throw new Error(`status ${res.status}`);
    const declared = Number(res.headers.get("content-length"));
    if (declared > MAX_IMAGE_BYTES) throw new Error("too large");
    const data = new Uint8Array(await res.arrayBuffer());
    const contentType = sniffImageType(data);
    if (!contentType) throw new Error("not a PNG, JPEG or WebP image");

    if ((await prisma.storedImage.count()) >= MAX_STORED) return { contentType, data };
    await prisma.storedImage.upsert({
      where: { sourceUrl: url },
      create: { sourceUrl: url, contentType, data },
      update: {},
    });
    failedAt().delete(url);
    return { contentType, data };
  } catch {
    failedAt().set(url, Date.now());
    return null;
  }
}

/** The saved copy, fetching and saving it first if this is the first time. */
export async function getImage(url: string): Promise<Image | null> {
  const ok = storableImageUrl(url);
  if (!ok) return null;
  return (await readStoredImage(ok)) ?? (await fetchAndStoreImage(ok));
}

/**
 * Saves a copy of every set logo and icon that isn't saved yet — at most `limit` per call, a few at a time,
 * so a fresh install fills in over a few minutes. A logo the catalog lists as .png that is only served as
 * .webp is saved as .webp (the page asks for both, in that order).
 */
export async function warmImages(limit = 60): Promise<{ saved: number; remaining: number }> {
  const [logos, icons, have] = await Promise.all([
    prisma.officialSet.findMany({ where: { logoUrl: { not: null } }, select: { logoUrl: true } }),
    prisma.cardSet.findMany({ where: { iconUrl: { not: null } }, select: { iconUrl: true } }),
    prisma.storedImage.findMany({ select: { sourceUrl: true } }),
  ]);
  const stored = new Set(have.map((h) => h.sourceUrl));
  const wanted = new Set<string>();
  for (const l of logos) {
    const png = storableImageUrl(l.logoUrl);
    if (png && !stored.has(png) && !stored.has(png.replace(/\.png$/i, ".webp"))) wanted.add(png);
  }
  for (const i of icons) {
    const u = storableImageUrl(i.iconUrl);
    if (u && !stored.has(u)) wanted.add(u);
  }

  const batch = [...wanted].slice(0, limit);
  let saved = 0;
  let next = 0;
  async function worker() {
    while (next < batch.length) {
      const url = batch[next++];
      let image = await fetchAndStoreImage(url);
      if (!image && /\.png$/i.test(url)) image = await fetchAndStoreImage(url.replace(/\.png$/i, ".webp"));
      if (image) saved++;
    }
  }
  await Promise.all(Array.from({ length: 4 }, worker));
  return { saved, remaining: wanted.size - saved };
}
