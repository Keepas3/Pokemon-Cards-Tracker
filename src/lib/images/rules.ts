// Which images the site keeps copies of, and what counts as a real image. Pure and client-safe.

/** Only these hosts are ever fetched: the card catalog's logos and tcgapi.dev's set icons and box pictures. */
const STORABLE_HOSTS = new Set(["assets.tcgdex.net", "tcgplayer-cdn.tcgplayer.com", "product-images.tcgplayer.com"]);
const MAX_URL_LENGTH = 512;

/** The normalised address if it's an https image on an allowed host, otherwise null. */
export function storableImageUrl(value: unknown): string | null {
  if (typeof value !== "string" || value.length > MAX_URL_LENGTH) return null;
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || !STORABLE_HOSTS.has(url.hostname) || url.port) return null;
  if (url.username || url.password || url.search || url.hash) return null;
  if (!/\.(png|webp|jpe?g)$/i.test(url.pathname)) return null;
  return url.href;
}

/** What an <img> should load: our own saved copy when the image is one we keep, otherwise the address as given. */
export function storedImageSrc(url: string): string {
  const ok = storableImageUrl(url);
  return ok ? `/api/img?u=${encodeURIComponent(ok)}` : url;
}

export const MAX_IMAGE_BYTES = 1_500_000;

const SIGNATURES: { type: string; matches: (b: Uint8Array) => boolean }[] = [
  { type: "image/png", matches: (b) => b.length > 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 },
  { type: "image/jpeg", matches: (b) => b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  {
    type: "image/webp",
    // "RIFF" ???? "WEBP"
    matches: (b) => b.length > 12 && b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50,
  },
];

/** The image type if these bytes really are a PNG, JPEG or WebP of a sensible size — judged by the bytes, not by what the server claimed. */
export function sniffImageType(bytes: Uint8Array): string | null {
  if (bytes.length === 0 || bytes.length > MAX_IMAGE_BYTES) return null;
  return SIGNATURES.find((s) => s.matches(bytes))?.type ?? null;
}
