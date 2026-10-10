import Watchlist from "@/components/Watchlist";
import type { WatchlistTab } from "@/components/Watchlist";

export const metadata = { title: "Watchlist" };

const TABS: WatchlistTab[] = ["cards", "alerts"];

export default async function WatchlistPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab } = await searchParams;
  const initialTab = TABS.find((t) => t === tab) ?? "cards";
  return <Watchlist initialTab={initialTab} />;
}
