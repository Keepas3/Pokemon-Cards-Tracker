import { redirect } from "next/navigation";

// The Cards page was folded into the Watchlist; old bookmarks land on its Cards tab.
export default function CardsPage() {
  redirect("/watchlist?tab=cards");
}
