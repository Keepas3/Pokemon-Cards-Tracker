import { CardPriceProvider } from "@/lib/clientTypes";

export const cardPriceProviderLabels: Record<CardPriceProvider, string> = {
  [CardPriceProvider.JUSTTCG]: "JustTCG",
  [CardPriceProvider.TCGAPI_DEV]: "TCG API",
};

export function formatPrice(cents: number | null | undefined): string {
  if (cents == null) return "—";
  // Thousands separators keep four-figure chase cards readable ($6,000.27).
  return `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatDate(date: string | Date | null | undefined): string {
  if (!date) return "unknown";
  const d = typeof date === "string" ? new Date(date) : date;
  // Release dates are calendar dates with no meaningful time-of-day, stored
  // as UTC midnight — format in UTC too, otherwise a viewer west of UTC sees
  // it shifted back a day (e.g. "2026-07-15" rendering as "Jul 14, 2026").
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" });
}

export function timeAgo(date: string | Date | null | undefined): string {
  if (!date) return "never";
  const d = typeof date === "string" ? new Date(date) : date;
  const seconds = Math.round((Date.now() - d.getTime()) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}
